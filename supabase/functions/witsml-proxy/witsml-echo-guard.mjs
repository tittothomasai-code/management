// Credential echo guard for the WITSML proxies (game route, Supabase fallback,
// machine route). Self-contained: no imports, so the same bytes ship in every
// copy and tests pin the sha256.
//
// Policy (8 Nov decision): a password-only match is REDACTED IN PLACE and the
// reply is still returned (HTTP 200) with value-free slot metadata; the reply
// is REFUSED (fail closed) only when it cannot be redacted safely:
//   * the user:password pair, the Basic token or header, or a caller key
//     appears in any decoded view              -> "credential-reflection"
//   * the password is split across markup (tags, comments, PIs, CDATA joined
//     with other nodes) or sits where no slot role exists (PI, version, result)
//                                              -> "credential-reflection"
//   * the password is in an element or attribute NAME -> "structural"
//   * a DOCTYPE / ENTITY / other "<!" declaration at document level
//                                              -> "unsafe-xml"
//   * a field over MAX_FIELD_CHARS             -> "guard-limit"
//   * any internal error                       -> "guard-error"
//
// How text is read: one sequential tokenizer modelled on browser XML parsing
// (comments and PIs skipped, quote-aware tags, CDATA bodies emitted literally
// and never re-read as markup, XML character references decoded). On top of
// that, every decoding round is scanned (never only the last), with two rule
// sets: XML (strict, ';' required) and HTML (numeric refs with optional ';',
// the full WHATWG named-reference table, longest match, including the legacy
// names that need no ';'), because the game puts names into innerHTML; when
// a value holds markup, a secret that the HTML parser could assemble from
// it (see markupSplitHit) is refused. Redaction maps a match found at any
// round back to the exact span of the node's decoded text, replaces that span
// with the mark, and re-serializes only that node. Every reply is re-scanned
// after redaction with all views; anything left is refused.
//
// All scanning is linear: comment/CDATA/PI closers use indexOf and an
// unterminated opener disables that construct for the rest of the string;
// a tag attempt never reads past the next '<'. Redaction is linear in the
// number of hits and stops as soon as more than MAX_REDACTION_SLOTS slots
// would be needed (the document is then withheld as "slot-limit"). Decode
// maps are sparse (one entry per reference) and are charged to the work
// budget. Nothing here logs. Secrets never leave this module except as
// booleans.

const MIN_SECRET = 4;
const MAX_ROUNDS = 8;
// 4 MiB per field. The store's own per-query ceiling (GetCap maxDataNodes
// 10,000 rows, maxDataPoints 100,000 values) is about 1.5 MB of XMLout, and
// the game asks for at most 5,000 rows; 4 MiB is 2.5x that, and it keeps the
// worst adversarial reply near 1 s (or a fast "guard-limit") on the game
// route. The machine route caps replies at 2 MB before the guard runs.
export const MAX_FIELD_CHARS = 4 * 1024 * 1024;
export const MAX_REDACTION_SLOTS = 1024;
export const GAME_REDACTION_MARK = "[redacted]";
export const GUARD_REASONS = Object.freeze(["credential-reflection", "structural", "unsafe-xml", "guard-limit", "guard-error"]);

// Work budget per scan: characters decoded or tokenized, plus decode-map
// entries, as a multiple of the input. Real replies use under 10x (a 4 MiB
// log reply about 3x); deeply nested escapes that would need more than 16x
// are refused as "guard-limit" instead of burning the function's time (about
// 1 s at the 4 MiB cap).
const WORK_FACTOR = 16;
// Node cap per tokenized string. A 15 MB real log reply has about 0.5 M text
// nodes and 0.6 M names; more than this is refused as "guard-limit" so the
// function stays well inside its memory.
const MAX_NODES = 1500000;
let budget = Infinity;
class GuardLimit extends Error {}
const spend = (n) => { budget -= n; if (budget < 0) throw new GuardLimit("guard-limit"); };

const long = (value) => typeof value === "string" && [...value].length >= MIN_SECRET;
const uniq = (list) => [...new Set(list)];

// ---------------------------------------------------------------- references
const XML_NAMED = { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" };
// The WHATWG HTML named character reference table
// (https://html.spec.whatwg.org/entities.json, 2,231 entries): each entry is
// name, "!" when the legacy form without ";" is also recognised, ":" and the
// code points in hex. HTML_SEMI holds every "name;" and HTML_LEGACY the 106
// names that also match without ";".
const HTML_TABLE = "AElig!:c6 AMP!:26 Aacute!:c1 Abreve:102 Acirc!:c2 Acy:410 Afr:1d504 Agrave!:c0 Alpha:391 Amacr:100 And:2a53 Aogon:104 Aopf:1d538 ApplyFunction:2061 Aring!:c5 Ascr:1d49c Assign:2254 Atilde!:c3 Auml!:c4 Backslash:2216 Barv:2ae7 Barwed:2306 Bcy:411 Because:2235 Bernoullis:212c Beta:392 Bfr:1d505 Bopf:1d539 Breve:2d8 Bscr:212c Bumpeq:224e CHcy:427 COPY!:a9 Cacute:106 Cap:22d2 CapitalDifferentialD:2145 Cayleys:212d Ccaron:10c Ccedil!:c7 Ccirc:108 Cconint:2230 Cdot:10a Cedilla:b8 CenterDot:b7 Cfr:212d Chi:3a7 CircleDot:2299 CircleMinus:2296 CirclePlus:2295 CircleTimes:2297 ClockwiseContourIntegral:2232 CloseCurlyDoubleQuote:201d CloseCurlyQuote:2019 Colon:2237 Colone:2a74 Congruent:2261 Conint:222f ContourIntegral:222e Copf:2102 Coproduct:2210 CounterClockwiseContourIntegral:2233 Cross:2a2f Cscr:1d49e Cup:22d3 CupCap:224d DD:2145 DDotrahd:2911 DJcy:402 DScy:405 DZcy:40f Dagger:2021 Darr:21a1 Dashv:2ae4 Dcaron:10e Dcy:414 Del:2207 Delta:394 Dfr:1d507 DiacriticalAcute:b4 DiacriticalDot:2d9 DiacriticalDoubleAcute:2dd DiacriticalGrave:60 DiacriticalTilde:2dc Diamond:22c4 DifferentialD:2146 Dopf:1d53b Dot:a8 DotDot:20dc DotEqual:2250 DoubleContourIntegral:222f DoubleDot:a8 DoubleDownArrow:21d3 DoubleLeftArrow:21d0 DoubleLeftRightArrow:21d4 DoubleLeftTee:2ae4 DoubleLongLeftArrow:27f8 DoubleLongLeftRightArrow:27fa DoubleLongRightArrow:27f9 DoubleRightArrow:21d2 DoubleRightTee:22a8 DoubleUpArrow:21d1 DoubleUpDownArrow:21d5 DoubleVerticalBar:2225 DownArrow:2193 DownArrowBar:2913 DownArrowUpArrow:21f5 DownBreve:311 DownLeftRightVector:2950 DownLeftTeeVector:295e DownLeftVector:21bd DownLeftVectorBar:2956 DownRightTeeVector:295f DownRightVector:21c1 DownRightVectorBar:2957 DownTee:22a4 DownTeeArrow:21a7 Downarrow:21d3 Dscr:1d49f Dstrok:110 ENG:14a ETH!:d0 Eacute!:c9 Ecaron:11a Ecirc!:ca Ecy:42d Edot:116 Efr:1d508 Egrave!:c8 Element:2208 Emacr:112 EmptySmallSquare:25fb EmptyVerySmallSquare:25ab Eogon:118 Eopf:1d53c Epsilon:395 Equal:2a75 EqualTilde:2242 Equilibrium:21cc Escr:2130 Esim:2a73 Eta:397 Euml!:cb Exists:2203 ExponentialE:2147 Fcy:424 Ffr:1d509 FilledSmallSquare:25fc FilledVerySmallSquare:25aa Fopf:1d53d ForAll:2200 Fouriertrf:2131 Fscr:2131 GJcy:403 GT!:3e Gamma:393 Gammad:3dc Gbreve:11e Gcedil:122 Gcirc:11c Gcy:413 Gdot:120 Gfr:1d50a Gg:22d9 Gopf:1d53e GreaterEqual:2265 GreaterEqualLess:22db GreaterFullEqual:2267 GreaterGreater:2aa2 GreaterLess:2277 GreaterSlantEqual:2a7e GreaterTilde:2273 Gscr:1d4a2 Gt:226b HARDcy:42a Hacek:2c7 Hat:5e Hcirc:124 Hfr:210c HilbertSpace:210b Hopf:210d HorizontalLine:2500 Hscr:210b Hstrok:126 HumpDownHump:224e HumpEqual:224f IEcy:415 IJlig:132 IOcy:401 Iacute!:cd Icirc!:ce Icy:418 Idot:130 Ifr:2111 Igrave!:cc Im:2111 Imacr:12a ImaginaryI:2148 Implies:21d2 Int:222c Integral:222b Intersection:22c2 InvisibleComma:2063 InvisibleTimes:2062 Iogon:12e Iopf:1d540 Iota:399 Iscr:2110 Itilde:128 Iukcy:406 Iuml!:cf Jcirc:134 Jcy:419 Jfr:1d50d Jopf:1d541 Jscr:1d4a5 Jsercy:408 Jukcy:404 KHcy:425 KJcy:40c Kappa:39a Kcedil:136 Kcy:41a Kfr:1d50e Kopf:1d542 Kscr:1d4a6 LJcy:409 LT!:3c Lacute:139 Lambda:39b Lang:27ea Laplacetrf:2112 Larr:219e Lcaron:13d Lcedil:13b Lcy:41b LeftAngleBracket:27e8 LeftArrow:2190 LeftArrowBar:21e4 LeftArrowRightArrow:21c6 LeftCeiling:2308 LeftDoubleBracket:27e6 LeftDownTeeVector:2961 LeftDownVector:21c3 LeftDownVectorBar:2959 LeftFloor:230a LeftRightArrow:2194 LeftRightVector:294e LeftTee:22a3 LeftTeeArrow:21a4 LeftTeeVector:295a LeftTriangle:22b2 LeftTriangleBar:29cf LeftTriangleEqual:22b4 LeftUpDownVector:2951 LeftUpTeeVector:2960 LeftUpVector:21bf LeftUpVectorBar:2958 LeftVector:21bc LeftVectorBar:2952 Leftarrow:21d0 Leftrightarrow:21d4 LessEqualGreater:22da LessFullEqual:2266 LessGreater:2276 LessLess:2aa1 LessSlantEqual:2a7d LessTilde:2272 Lfr:1d50f Ll:22d8 Lleftarrow:21da Lmidot:13f LongLeftArrow:27f5 LongLeftRightArrow:27f7 LongRightArrow:27f6 Longleftarrow:27f8 Longleftrightarrow:27fa Longrightarrow:27f9 Lopf:1d543 LowerLeftArrow:2199 LowerRightArrow:2198 Lscr:2112 Lsh:21b0 Lstrok:141 Lt:226a Map:2905 Mcy:41c MediumSpace:205f Mellintrf:2133 Mfr:1d510 MinusPlus:2213 Mopf:1d544 Mscr:2133 Mu:39c NJcy:40a Nacute:143 Ncaron:147 Ncedil:145 Ncy:41d NegativeMediumSpace:200b NegativeThickSpace:200b NegativeThinSpace:200b NegativeVeryThinSpace:200b NestedGreaterGreater:226b NestedLessLess:226a NewLine:a Nfr:1d511 NoBreak:2060 NonBreakingSpace:a0 Nopf:2115 Not:2aec NotCongruent:2262 NotCupCap:226d NotDoubleVerticalBar:2226 NotElement:2209 NotEqual:2260 NotEqualTilde:2242.338 NotExists:2204 NotGreater:226f NotGreaterEqual:2271 NotGreaterFullEqual:2267.338 NotGreaterGreater:226b.338 NotGreaterLess:2279 NotGreaterSlantEqual:2a7e.338 NotGreaterTilde:2275 NotHumpDownHump:224e.338 NotHumpEqual:224f.338 NotLeftTriangle:22ea NotLeftTriangleBar:29cf.338 NotLeftTriangleEqual:22ec NotLess:226e NotLessEqual:2270 NotLessGreater:2278 NotLessLess:226a.338 NotLessSlantEqual:2a7d.338 NotLessTilde:2274 NotNestedGreaterGreater:2aa2.338 NotNestedLessLess:2aa1.338 NotPrecedes:2280 NotPrecedesEqual:2aaf.338 NotPrecedesSlantEqual:22e0 NotReverseElement:220c NotRightTriangle:22eb NotRightTriangleBar:29d0.338 NotRightTriangleEqual:22ed NotSquareSubset:228f.338 NotSquareSubsetEqual:22e2 NotSquareSuperset:2290.338 NotSquareSupersetEqual:22e3 NotSubset:2282.20d2 NotSubsetEqual:2288 NotSucceeds:2281 NotSucceedsEqual:2ab0.338 NotSucceedsSlantEqual:22e1 NotSucceedsTilde:227f.338 NotSuperset:2283.20d2 NotSupersetEqual:2289 NotTilde:2241 NotTildeEqual:2244 NotTildeFullEqual:2247 NotTildeTilde:2249 NotVerticalBar:2224 Nscr:1d4a9 Ntilde!:d1 Nu:39d OElig:152 Oacute!:d3 Ocirc!:d4 Ocy:41e Odblac:150 Ofr:1d512 Ograve!:d2 Omacr:14c Omega:3a9 Omicron:39f Oopf:1d546 OpenCurlyDoubleQuote:201c OpenCurlyQuote:2018 Or:2a54 Oscr:1d4aa Oslash!:d8 Otilde!:d5 Otimes:2a37 Ouml!:d6 OverBar:203e OverBrace:23de OverBracket:23b4 OverParenthesis:23dc PartialD:2202 Pcy:41f Pfr:1d513 Phi:3a6 Pi:3a0 PlusMinus:b1 Poincareplane:210c Popf:2119 Pr:2abb Precedes:227a PrecedesEqual:2aaf PrecedesSlantEqual:227c PrecedesTilde:227e Prime:2033 Product:220f Proportion:2237 Proportional:221d Pscr:1d4ab Psi:3a8 QUOT!:22 Qfr:1d514 Qopf:211a Qscr:1d4ac RBarr:2910 REG!:ae Racute:154 Rang:27eb Rarr:21a0 Rarrtl:2916 Rcaron:158 Rcedil:156 Rcy:420 Re:211c ReverseElement:220b ReverseEquilibrium:21cb ReverseUpEquilibrium:296f Rfr:211c Rho:3a1 RightAngleBracket:27e9 RightArrow:2192 RightArrowBar:21e5 RightArrowLeftArrow:21c4 RightCeiling:2309 RightDoubleBracket:27e7 RightDownTeeVector:295d RightDownVector:21c2 RightDownVectorBar:2955 RightFloor:230b RightTee:22a2 RightTeeArrow:21a6 RightTeeVector:295b RightTriangle:22b3 RightTriangleBar:29d0 RightTriangleEqual:22b5 RightUpDownVector:294f RightUpTeeVector:295c RightUpVector:21be RightUpVectorBar:2954 RightVector:21c0 RightVectorBar:2953 Rightarrow:21d2 Ropf:211d RoundImplies:2970 Rrightarrow:21db Rscr:211b Rsh:21b1 RuleDelayed:29f4 SHCHcy:429 SHcy:428 SOFTcy:42c Sacute:15a Sc:2abc Scaron:160 Scedil:15e Scirc:15c Scy:421 Sfr:1d516 ShortDownArrow:2193 ShortLeftArrow:2190 ShortRightArrow:2192 ShortUpArrow:2191 Sigma:3a3 SmallCircle:2218 Sopf:1d54a Sqrt:221a Square:25a1 SquareIntersection:2293 SquareSubset:228f SquareSubsetEqual:2291 SquareSuperset:2290 SquareSupersetEqual:2292 SquareUnion:2294 Sscr:1d4ae Star:22c6 Sub:22d0 Subset:22d0 SubsetEqual:2286 Succeeds:227b SucceedsEqual:2ab0 SucceedsSlantEqual:227d SucceedsTilde:227f SuchThat:220b Sum:2211 Sup:22d1 Superset:2283 SupersetEqual:2287 Supset:22d1 THORN!:de TRADE:2122 TSHcy:40b TScy:426 Tab:9 Tau:3a4 Tcaron:164 Tcedil:162 Tcy:422 Tfr:1d517 Therefore:2234 Theta:398 ThickSpace:205f.200a ThinSpace:2009 Tilde:223c TildeEqual:2243 TildeFullEqual:2245 TildeTilde:2248 Topf:1d54b TripleDot:20db Tscr:1d4af Tstrok:166 Uacute!:da Uarr:219f Uarrocir:2949 Ubrcy:40e Ubreve:16c Ucirc!:db Ucy:423 Udblac:170 Ufr:1d518 Ugrave!:d9 Umacr:16a UnderBar:5f UnderBrace:23df UnderBracket:23b5 UnderParenthesis:23dd Union:22c3 UnionPlus:228e Uogon:172 Uopf:1d54c UpArrow:2191 UpArrowBar:2912 UpArrowDownArrow:21c5 UpDownArrow:2195 UpEquilibrium:296e UpTee:22a5 UpTeeArrow:21a5 Uparrow:21d1 Updownarrow:21d5 UpperLeftArrow:2196 UpperRightArrow:2197 Upsi:3d2 Upsilon:3a5 Uring:16e Uscr:1d4b0 Utilde:168 Uuml!:dc VDash:22ab Vbar:2aeb Vcy:412 Vdash:22a9 Vdashl:2ae6 Vee:22c1 Verbar:2016 Vert:2016 VerticalBar:2223 VerticalLine:7c VerticalSeparator:2758 VerticalTilde:2240 VeryThinSpace:200a Vfr:1d519 Vopf:1d54d Vscr:1d4b1 Vvdash:22aa Wcirc:174 Wedge:22c0 Wfr:1d51a Wopf:1d54e Wscr:1d4b2 Xfr:1d51b Xi:39e Xopf:1d54f Xscr:1d4b3 YAcy:42f YIcy:407 YUcy:42e Yacute!:dd Ycirc:176 Ycy:42b Yfr:1d51c Yopf:1d550 Yscr:1d4b4 Yuml:178 ZHcy:416 Zacute:179 Zcaron:17d Zcy:417 Zdot:17b ZeroWidthSpace:200b Zeta:396 Zfr:2128 Zopf:2124 Zscr:1d4b5 aacute!:e1 abreve:103 ac:223e acE:223e.333 acd:223f acirc!:e2 acute!:b4 acy:430 aelig!:e6 af:2061 afr:1d51e agrave!:e0 alefsym:2135 aleph:2135 alpha:3b1 amacr:101 amalg:2a3f amp!:26 and:2227 andand:2a55 andd:2a5c andslope:2a58 andv:2a5a ang:2220 ange:29a4 angle:2220 angmsd:2221 angmsdaa:29a8 angmsdab:29a9 angmsdac:29aa angmsdad:29ab angmsdae:29ac angmsdaf:29ad angmsdag:29ae angmsdah:29af angrt:221f angrtvb:22be angrtvbd:299d angsph:2222 angst:c5 angzarr:237c aogon:105 aopf:1d552 ap:2248 apE:2a70 apacir:2a6f ape:224a apid:224b apos:27 approx:2248 approxeq:224a aring!:e5 ascr:1d4b6 ast:2a asymp:2248 asympeq:224d atilde!:e3 auml!:e4 awconint:2233 awint:2a11 bNot:2aed backcong:224c backepsilon:3f6 backprime:2035 backsim:223d backsimeq:22cd barvee:22bd barwed:2305 barwedge:2305 bbrk:23b5 bbrktbrk:23b6 bcong:224c bcy:431 bdquo:201e becaus:2235 because:2235 bemptyv:29b0 bepsi:3f6 bernou:212c beta:3b2 beth:2136 between:226c bfr:1d51f bigcap:22c2 bigcirc:25ef bigcup:22c3 bigodot:2a00 bigoplus:2a01 bigotimes:2a02 bigsqcup:2a06 bigstar:2605 bigtriangledown:25bd bigtriangleup:25b3 biguplus:2a04 bigvee:22c1 bigwedge:22c0 bkarow:290d blacklozenge:29eb blacksquare:25aa blacktriangle:25b4 blacktriangledown:25be blacktriangleleft:25c2 blacktriangleright:25b8 blank:2423 blk12:2592 blk14:2591 blk34:2593 block:2588 bne:3d.20e5 bnequiv:2261.20e5 bnot:2310 bopf:1d553 bot:22a5 bottom:22a5 bowtie:22c8 boxDL:2557 boxDR:2554 boxDl:2556 boxDr:2553 boxH:2550 boxHD:2566 boxHU:2569 boxHd:2564 boxHu:2567 boxUL:255d boxUR:255a boxUl:255c boxUr:2559 boxV:2551 boxVH:256c boxVL:2563 boxVR:2560 boxVh:256b boxVl:2562 boxVr:255f boxbox:29c9 boxdL:2555 boxdR:2552 boxdl:2510 boxdr:250c boxh:2500 boxhD:2565 boxhU:2568 boxhd:252c boxhu:2534 boxminus:229f boxplus:229e boxtimes:22a0 boxuL:255b boxuR:2558 boxul:2518 boxur:2514 boxv:2502 boxvH:256a boxvL:2561 boxvR:255e boxvh:253c boxvl:2524 boxvr:251c bprime:2035 breve:2d8 brvbar!:a6 bscr:1d4b7 bsemi:204f bsim:223d bsime:22cd bsol:5c bsolb:29c5 bsolhsub:27c8 bull:2022 bullet:2022 bump:224e bumpE:2aae bumpe:224f bumpeq:224f cacute:107 cap:2229 capand:2a44 capbrcup:2a49 capcap:2a4b capcup:2a47 capdot:2a40 caps:2229.fe00 caret:2041 caron:2c7 ccaps:2a4d ccaron:10d ccedil!:e7 ccirc:109 ccups:2a4c ccupssm:2a50 cdot:10b cedil!:b8 cemptyv:29b2 cent!:a2 centerdot:b7 cfr:1d520 chcy:447 check:2713 checkmark:2713 chi:3c7 cir:25cb cirE:29c3 circ:2c6 circeq:2257 circlearrowleft:21ba circlearrowright:21bb circledR:ae circledS:24c8 circledast:229b circledcirc:229a circleddash:229d cire:2257 cirfnint:2a10 cirmid:2aef cirscir:29c2 clubs:2663 clubsuit:2663 colon:3a colone:2254 coloneq:2254 comma:2c commat:40 comp:2201 compfn:2218 complement:2201 complexes:2102 cong:2245 congdot:2a6d conint:222e copf:1d554 coprod:2210 copy!:a9 copysr:2117 crarr:21b5 cross:2717 cscr:1d4b8 csub:2acf csube:2ad1 csup:2ad0 csupe:2ad2 ctdot:22ef cudarrl:2938 cudarrr:2935 cuepr:22de cuesc:22df cularr:21b6 cularrp:293d cup:222a cupbrcap:2a48 cupcap:2a46 cupcup:2a4a cupdot:228d cupor:2a45 cups:222a.fe00 curarr:21b7 curarrm:293c curlyeqprec:22de curlyeqsucc:22df curlyvee:22ce curlywedge:22cf curren!:a4 curvearrowleft:21b6 curvearrowright:21b7 cuvee:22ce cuwed:22cf cwconint:2232 cwint:2231 cylcty:232d dArr:21d3 dHar:2965 dagger:2020 daleth:2138 darr:2193 dash:2010 dashv:22a3 dbkarow:290f dblac:2dd dcaron:10f dcy:434 dd:2146 ddagger:2021 ddarr:21ca ddotseq:2a77 deg!:b0 delta:3b4 demptyv:29b1 dfisht:297f dfr:1d521 dharl:21c3 dharr:21c2 diam:22c4 diamond:22c4 diamondsuit:2666 diams:2666 die:a8 digamma:3dd disin:22f2 div:f7 divide!:f7 divideontimes:22c7 divonx:22c7 djcy:452 dlcorn:231e dlcrop:230d dollar:24 dopf:1d555 dot:2d9 doteq:2250 doteqdot:2251 dotminus:2238 dotplus:2214 dotsquare:22a1 doublebarwedge:2306 downarrow:2193 downdownarrows:21ca downharpoonleft:21c3 downharpoonright:21c2 drbkarow:2910 drcorn:231f drcrop:230c dscr:1d4b9 dscy:455 dsol:29f6 dstrok:111 dtdot:22f1 dtri:25bf dtrif:25be duarr:21f5 duhar:296f dwangle:29a6 dzcy:45f dzigrarr:27ff eDDot:2a77 eDot:2251 eacute!:e9 easter:2a6e ecaron:11b ecir:2256 ecirc!:ea ecolon:2255 ecy:44d edot:117 ee:2147 efDot:2252 efr:1d522 eg:2a9a egrave!:e8 egs:2a96 egsdot:2a98 el:2a99 elinters:23e7 ell:2113 els:2a95 elsdot:2a97 emacr:113 empty:2205 emptyset:2205 emptyv:2205 emsp:2003 emsp13:2004 emsp14:2005 eng:14b ensp:2002 eogon:119 eopf:1d556 epar:22d5 eparsl:29e3 eplus:2a71 epsi:3b5 epsilon:3b5 epsiv:3f5 eqcirc:2256 eqcolon:2255 eqsim:2242 eqslantgtr:2a96 eqslantless:2a95 equals:3d equest:225f equiv:2261 equivDD:2a78 eqvparsl:29e5 erDot:2253 erarr:2971 escr:212f esdot:2250 esim:2242 eta:3b7 eth!:f0 euml!:eb euro:20ac excl:21 exist:2203 expectation:2130 exponentiale:2147 fallingdotseq:2252 fcy:444 female:2640 ffilig:fb03 fflig:fb00 ffllig:fb04 ffr:1d523 filig:fb01 fjlig:66.6a flat:266d fllig:fb02 fltns:25b1 fnof:192 fopf:1d557 forall:2200 fork:22d4 forkv:2ad9 fpartint:2a0d frac12!:bd frac13:2153 frac14!:bc frac15:2155 frac16:2159 frac18:215b frac23:2154 frac25:2156 frac34!:be frac35:2157 frac38:215c frac45:2158 frac56:215a frac58:215d frac78:215e frasl:2044 frown:2322 fscr:1d4bb gE:2267 gEl:2a8c gacute:1f5 gamma:3b3 gammad:3dd gap:2a86 gbreve:11f gcirc:11d gcy:433 gdot:121 ge:2265 gel:22db geq:2265 geqq:2267 geqslant:2a7e ges:2a7e gescc:2aa9 gesdot:2a80 gesdoto:2a82 gesdotol:2a84 gesl:22db.fe00 gesles:2a94 gfr:1d524 gg:226b ggg:22d9 gimel:2137 gjcy:453 gl:2277 glE:2a92 gla:2aa5 glj:2aa4 gnE:2269 gnap:2a8a gnapprox:2a8a gne:2a88 gneq:2a88 gneqq:2269 gnsim:22e7 gopf:1d558 grave:60 gscr:210a gsim:2273 gsime:2a8e gsiml:2a90 gt!:3e gtcc:2aa7 gtcir:2a7a gtdot:22d7 gtlPar:2995 gtquest:2a7c gtrapprox:2a86 gtrarr:2978 gtrdot:22d7 gtreqless:22db gtreqqless:2a8c gtrless:2277 gtrsim:2273 gvertneqq:2269.fe00 gvnE:2269.fe00 hArr:21d4 hairsp:200a half:bd hamilt:210b hardcy:44a harr:2194 harrcir:2948 harrw:21ad hbar:210f hcirc:125 hearts:2665 heartsuit:2665 hellip:2026 hercon:22b9 hfr:1d525 hksearow:2925 hkswarow:2926 hoarr:21ff homtht:223b hookleftarrow:21a9 hookrightarrow:21aa hopf:1d559 horbar:2015 hscr:1d4bd hslash:210f hstrok:127 hybull:2043 hyphen:2010 iacute!:ed ic:2063 icirc!:ee icy:438 iecy:435 iexcl!:a1 iff:21d4 ifr:1d526 igrave!:ec ii:2148 iiiint:2a0c iiint:222d iinfin:29dc iiota:2129 ijlig:133 imacr:12b image:2111 imagline:2110 imagpart:2111 imath:131 imof:22b7 imped:1b5 in:2208 incare:2105 infin:221e infintie:29dd inodot:131 int:222b intcal:22ba integers:2124 intercal:22ba intlarhk:2a17 intprod:2a3c iocy:451 iogon:12f iopf:1d55a iota:3b9 iprod:2a3c iquest!:bf iscr:1d4be isin:2208 isinE:22f9 isindot:22f5 isins:22f4 isinsv:22f3 isinv:2208 it:2062 itilde:129 iukcy:456 iuml!:ef jcirc:135 jcy:439 jfr:1d527 jmath:237 jopf:1d55b jscr:1d4bf jsercy:458 jukcy:454 kappa:3ba kappav:3f0 kcedil:137 kcy:43a kfr:1d528 kgreen:138 khcy:445 kjcy:45c kopf:1d55c kscr:1d4c0 lAarr:21da lArr:21d0 lAtail:291b lBarr:290e lE:2266 lEg:2a8b lHar:2962 lacute:13a laemptyv:29b4 lagran:2112 lambda:3bb lang:27e8 langd:2991 langle:27e8 lap:2a85 laquo!:ab larr:2190 larrb:21e4 larrbfs:291f larrfs:291d larrhk:21a9 larrlp:21ab larrpl:2939 larrsim:2973 larrtl:21a2 lat:2aab latail:2919 late:2aad lates:2aad.fe00 lbarr:290c lbbrk:2772 lbrace:7b lbrack:5b lbrke:298b lbrksld:298f lbrkslu:298d lcaron:13e lcedil:13c lceil:2308 lcub:7b lcy:43b ldca:2936 ldquo:201c ldquor:201e ldrdhar:2967 ldrushar:294b ldsh:21b2 le:2264 leftarrow:2190 leftarrowtail:21a2 leftharpoondown:21bd leftharpoonup:21bc leftleftarrows:21c7 leftrightarrow:2194 leftrightarrows:21c6 leftrightharpoons:21cb leftrightsquigarrow:21ad leftthreetimes:22cb leg:22da leq:2264 leqq:2266 leqslant:2a7d les:2a7d lescc:2aa8 lesdot:2a7f lesdoto:2a81 lesdotor:2a83 lesg:22da.fe00 lesges:2a93 lessapprox:2a85 lessdot:22d6 lesseqgtr:22da lesseqqgtr:2a8b lessgtr:2276 lesssim:2272 lfisht:297c lfloor:230a lfr:1d529 lg:2276 lgE:2a91 lhard:21bd lharu:21bc lharul:296a lhblk:2584 ljcy:459 ll:226a llarr:21c7 llcorner:231e llhard:296b lltri:25fa lmidot:140 lmoust:23b0 lmoustache:23b0 lnE:2268 lnap:2a89 lnapprox:2a89 lne:2a87 lneq:2a87 lneqq:2268 lnsim:22e6 loang:27ec loarr:21fd lobrk:27e6 longleftarrow:27f5 longleftrightarrow:27f7 longmapsto:27fc longrightarrow:27f6 looparrowleft:21ab looparrowright:21ac lopar:2985 lopf:1d55d loplus:2a2d lotimes:2a34 lowast:2217 lowbar:5f loz:25ca lozenge:25ca lozf:29eb lpar:28 lparlt:2993 lrarr:21c6 lrcorner:231f lrhar:21cb lrhard:296d lrm:200e lrtri:22bf lsaquo:2039 lscr:1d4c1 lsh:21b0 lsim:2272 lsime:2a8d lsimg:2a8f lsqb:5b lsquo:2018 lsquor:201a lstrok:142 lt!:3c ltcc:2aa6 ltcir:2a79 ltdot:22d6 lthree:22cb ltimes:22c9 ltlarr:2976 ltquest:2a7b ltrPar:2996 ltri:25c3 ltrie:22b4 ltrif:25c2 lurdshar:294a luruhar:2966 lvertneqq:2268.fe00 lvnE:2268.fe00 mDDot:223a macr!:af male:2642 malt:2720 maltese:2720 map:21a6 mapsto:21a6 mapstodown:21a7 mapstoleft:21a4 mapstoup:21a5 marker:25ae mcomma:2a29 mcy:43c mdash:2014 measuredangle:2221 mfr:1d52a mho:2127 micro!:b5 mid:2223 midast:2a midcir:2af0 middot!:b7 minus:2212 minusb:229f minusd:2238 minusdu:2a2a mlcp:2adb mldr:2026 mnplus:2213 models:22a7 mopf:1d55e mp:2213 mscr:1d4c2 mstpos:223e mu:3bc multimap:22b8 mumap:22b8 nGg:22d9.338 nGt:226b.20d2 nGtv:226b.338 nLeftarrow:21cd nLeftrightarrow:21ce nLl:22d8.338 nLt:226a.20d2 nLtv:226a.338 nRightarrow:21cf nVDash:22af nVdash:22ae nabla:2207 nacute:144 nang:2220.20d2 nap:2249 napE:2a70.338 napid:224b.338 napos:149 napprox:2249 natur:266e natural:266e naturals:2115 nbsp!:a0 nbump:224e.338 nbumpe:224f.338 ncap:2a43 ncaron:148 ncedil:146 ncong:2247 ncongdot:2a6d.338 ncup:2a42 ncy:43d ndash:2013 ne:2260 neArr:21d7 nearhk:2924 nearr:2197 nearrow:2197 nedot:2250.338 nequiv:2262 nesear:2928 nesim:2242.338 nexist:2204 nexists:2204 nfr:1d52b ngE:2267.338 nge:2271 ngeq:2271 ngeqq:2267.338 ngeqslant:2a7e.338 nges:2a7e.338 ngsim:2275 ngt:226f ngtr:226f nhArr:21ce nharr:21ae nhpar:2af2 ni:220b nis:22fc nisd:22fa niv:220b njcy:45a nlArr:21cd nlE:2266.338 nlarr:219a nldr:2025 nle:2270 nleftarrow:219a nleftrightarrow:21ae nleq:2270 nleqq:2266.338 nleqslant:2a7d.338 nles:2a7d.338 nless:226e nlsim:2274 nlt:226e nltri:22ea nltrie:22ec nmid:2224 nopf:1d55f not!:ac notin:2209 notinE:22f9.338 notindot:22f5.338 notinva:2209 notinvb:22f7 notinvc:22f6 notni:220c notniva:220c notnivb:22fe notnivc:22fd npar:2226 nparallel:2226 nparsl:2afd.20e5 npart:2202.338 npolint:2a14 npr:2280 nprcue:22e0 npre:2aaf.338 nprec:2280 npreceq:2aaf.338 nrArr:21cf nrarr:219b nrarrc:2933.338 nrarrw:219d.338 nrightarrow:219b nrtri:22eb nrtrie:22ed nsc:2281 nsccue:22e1 nsce:2ab0.338 nscr:1d4c3 nshortmid:2224 nshortparallel:2226 nsim:2241 nsime:2244 nsimeq:2244 nsmid:2224 nspar:2226 nsqsube:22e2 nsqsupe:22e3 nsub:2284 nsubE:2ac5.338 nsube:2288 nsubset:2282.20d2 nsubseteq:2288 nsubseteqq:2ac5.338 nsucc:2281 nsucceq:2ab0.338 nsup:2285 nsupE:2ac6.338 nsupe:2289 nsupset:2283.20d2 nsupseteq:2289 nsupseteqq:2ac6.338 ntgl:2279 ntilde!:f1 ntlg:2278 ntriangleleft:22ea ntrianglelefteq:22ec ntriangleright:22eb ntrianglerighteq:22ed nu:3bd num:23 numero:2116 numsp:2007 nvDash:22ad nvHarr:2904 nvap:224d.20d2 nvdash:22ac nvge:2265.20d2 nvgt:3e.20d2 nvinfin:29de nvlArr:2902 nvle:2264.20d2 nvlt:3c.20d2 nvltrie:22b4.20d2 nvrArr:2903 nvrtrie:22b5.20d2 nvsim:223c.20d2 nwArr:21d6 nwarhk:2923 nwarr:2196 nwarrow:2196 nwnear:2927 oS:24c8 oacute!:f3 oast:229b ocir:229a ocirc!:f4 ocy:43e odash:229d odblac:151 odiv:2a38 odot:2299 odsold:29bc oelig:153 ofcir:29bf ofr:1d52c ogon:2db ograve!:f2 ogt:29c1 ohbar:29b5 ohm:3a9 oint:222e olarr:21ba olcir:29be olcross:29bb oline:203e olt:29c0 omacr:14d omega:3c9 omicron:3bf omid:29b6 ominus:2296 oopf:1d560 opar:29b7 operp:29b9 oplus:2295 or:2228 orarr:21bb ord:2a5d order:2134 orderof:2134 ordf!:aa ordm!:ba origof:22b6 oror:2a56 orslope:2a57 orv:2a5b oscr:2134 oslash!:f8 osol:2298 otilde!:f5 otimes:2297 otimesas:2a36 ouml!:f6 ovbar:233d par:2225 para!:b6 parallel:2225 parsim:2af3 parsl:2afd part:2202 pcy:43f percnt:25 period:2e permil:2030 perp:22a5 pertenk:2031 pfr:1d52d phi:3c6 phiv:3d5 phmmat:2133 phone:260e pi:3c0 pitchfork:22d4 piv:3d6 planck:210f planckh:210e plankv:210f plus:2b plusacir:2a23 plusb:229e pluscir:2a22 plusdo:2214 plusdu:2a25 pluse:2a72 plusmn!:b1 plussim:2a26 plustwo:2a27 pm:b1 pointint:2a15 popf:1d561 pound!:a3 pr:227a prE:2ab3 prap:2ab7 prcue:227c pre:2aaf prec:227a precapprox:2ab7 preccurlyeq:227c preceq:2aaf precnapprox:2ab9 precneqq:2ab5 precnsim:22e8 precsim:227e prime:2032 primes:2119 prnE:2ab5 prnap:2ab9 prnsim:22e8 prod:220f profalar:232e profline:2312 profsurf:2313 prop:221d propto:221d prsim:227e prurel:22b0 pscr:1d4c5 psi:3c8 puncsp:2008 qfr:1d52e qint:2a0c qopf:1d562 qprime:2057 qscr:1d4c6 quaternions:210d quatint:2a16 quest:3f questeq:225f quot!:22 rAarr:21db rArr:21d2 rAtail:291c rBarr:290f rHar:2964 race:223d.331 racute:155 radic:221a raemptyv:29b3 rang:27e9 rangd:2992 range:29a5 rangle:27e9 raquo!:bb rarr:2192 rarrap:2975 rarrb:21e5 rarrbfs:2920 rarrc:2933 rarrfs:291e rarrhk:21aa rarrlp:21ac rarrpl:2945 rarrsim:2974 rarrtl:21a3 rarrw:219d ratail:291a ratio:2236 rationals:211a rbarr:290d rbbrk:2773 rbrace:7d rbrack:5d rbrke:298c rbrksld:298e rbrkslu:2990 rcaron:159 rcedil:157 rceil:2309 rcub:7d rcy:440 rdca:2937 rdldhar:2969 rdquo:201d rdquor:201d rdsh:21b3 real:211c realine:211b realpart:211c reals:211d rect:25ad reg!:ae rfisht:297d rfloor:230b rfr:1d52f rhard:21c1 rharu:21c0 rharul:296c rho:3c1 rhov:3f1 rightarrow:2192 rightarrowtail:21a3 rightharpoondown:21c1 rightharpoonup:21c0 rightleftarrows:21c4 rightleftharpoons:21cc rightrightarrows:21c9 rightsquigarrow:219d rightthreetimes:22cc ring:2da risingdotseq:2253 rlarr:21c4 rlhar:21cc rlm:200f rmoust:23b1 rmoustache:23b1 rnmid:2aee roang:27ed roarr:21fe robrk:27e7 ropar:2986 ropf:1d563 roplus:2a2e rotimes:2a35 rpar:29 rpargt:2994 rppolint:2a12 rrarr:21c9 rsaquo:203a rscr:1d4c7 rsh:21b1 rsqb:5d rsquo:2019 rsquor:2019 rthree:22cc rtimes:22ca rtri:25b9 rtrie:22b5 rtrif:25b8 rtriltri:29ce ruluhar:2968 rx:211e sacute:15b sbquo:201a sc:227b scE:2ab4 scap:2ab8 scaron:161 sccue:227d sce:2ab0 scedil:15f scirc:15d scnE:2ab6 scnap:2aba scnsim:22e9 scpolint:2a13 scsim:227f scy:441 sdot:22c5 sdotb:22a1 sdote:2a66 seArr:21d8 searhk:2925 searr:2198 searrow:2198 sect!:a7 semi:3b seswar:2929 setminus:2216 setmn:2216 sext:2736 sfr:1d530 sfrown:2322 sharp:266f shchcy:449 shcy:448 shortmid:2223 shortparallel:2225 shy!:ad sigma:3c3 sigmaf:3c2 sigmav:3c2 sim:223c simdot:2a6a sime:2243 simeq:2243 simg:2a9e simgE:2aa0 siml:2a9d simlE:2a9f simne:2246 simplus:2a24 simrarr:2972 slarr:2190 smallsetminus:2216 smashp:2a33 smeparsl:29e4 smid:2223 smile:2323 smt:2aaa smte:2aac smtes:2aac.fe00 softcy:44c sol:2f solb:29c4 solbar:233f sopf:1d564 spades:2660 spadesuit:2660 spar:2225 sqcap:2293 sqcaps:2293.fe00 sqcup:2294 sqcups:2294.fe00 sqsub:228f sqsube:2291 sqsubset:228f sqsubseteq:2291 sqsup:2290 sqsupe:2292 sqsupset:2290 sqsupseteq:2292 squ:25a1 square:25a1 squarf:25aa squf:25aa srarr:2192 sscr:1d4c8 ssetmn:2216 ssmile:2323 sstarf:22c6 star:2606 starf:2605 straightepsilon:3f5 straightphi:3d5 strns:af sub:2282 subE:2ac5 subdot:2abd sube:2286 subedot:2ac3 submult:2ac1 subnE:2acb subne:228a subplus:2abf subrarr:2979 subset:2282 subseteq:2286 subseteqq:2ac5 subsetneq:228a subsetneqq:2acb subsim:2ac7 subsub:2ad5 subsup:2ad3 succ:227b succapprox:2ab8 succcurlyeq:227d succeq:2ab0 succnapprox:2aba succneqq:2ab6 succnsim:22e9 succsim:227f sum:2211 sung:266a sup:2283 sup1!:b9 sup2!:b2 sup3!:b3 supE:2ac6 supdot:2abe supdsub:2ad8 supe:2287 supedot:2ac4 suphsol:27c9 suphsub:2ad7 suplarr:297b supmult:2ac2 supnE:2acc supne:228b supplus:2ac0 supset:2283 supseteq:2287 supseteqq:2ac6 supsetneq:228b supsetneqq:2acc supsim:2ac8 supsub:2ad4 supsup:2ad6 swArr:21d9 swarhk:2926 swarr:2199 swarrow:2199 swnwar:292a szlig!:df target:2316 tau:3c4 tbrk:23b4 tcaron:165 tcedil:163 tcy:442 tdot:20db telrec:2315 tfr:1d531 there4:2234 therefore:2234 theta:3b8 thetasym:3d1 thetav:3d1 thickapprox:2248 thicksim:223c thinsp:2009 thkap:2248 thksim:223c thorn!:fe tilde:2dc times!:d7 timesb:22a0 timesbar:2a31 timesd:2a30 tint:222d toea:2928 top:22a4 topbot:2336 topcir:2af1 topf:1d565 topfork:2ada tosa:2929 tprime:2034 trade:2122 triangle:25b5 triangledown:25bf triangleleft:25c3 trianglelefteq:22b4 triangleq:225c triangleright:25b9 trianglerighteq:22b5 tridot:25ec trie:225c triminus:2a3a triplus:2a39 trisb:29cd tritime:2a3b trpezium:23e2 tscr:1d4c9 tscy:446 tshcy:45b tstrok:167 twixt:226c twoheadleftarrow:219e twoheadrightarrow:21a0 uArr:21d1 uHar:2963 uacute!:fa uarr:2191 ubrcy:45e ubreve:16d ucirc!:fb ucy:443 udarr:21c5 udblac:171 udhar:296e ufisht:297e ufr:1d532 ugrave!:f9 uharl:21bf uharr:21be uhblk:2580 ulcorn:231c ulcorner:231c ulcrop:230f ultri:25f8 umacr:16b uml!:a8 uogon:173 uopf:1d566 uparrow:2191 updownarrow:2195 upharpoonleft:21bf upharpoonright:21be uplus:228e upsi:3c5 upsih:3d2 upsilon:3c5 upuparrows:21c8 urcorn:231d urcorner:231d urcrop:230e uring:16f urtri:25f9 uscr:1d4ca utdot:22f0 utilde:169 utri:25b5 utrif:25b4 uuarr:21c8 uuml!:fc uwangle:29a7 vArr:21d5 vBar:2ae8 vBarv:2ae9 vDash:22a8 vangrt:299c varepsilon:3f5 varkappa:3f0 varnothing:2205 varphi:3d5 varpi:3d6 varpropto:221d varr:2195 varrho:3f1 varsigma:3c2 varsubsetneq:228a.fe00 varsubsetneqq:2acb.fe00 varsupsetneq:228b.fe00 varsupsetneqq:2acc.fe00 vartheta:3d1 vartriangleleft:22b2 vartriangleright:22b3 vcy:432 vdash:22a2 vee:2228 veebar:22bb veeeq:225a vellip:22ee verbar:7c vert:7c vfr:1d533 vltri:22b2 vnsub:2282.20d2 vnsup:2283.20d2 vopf:1d567 vprop:221d vrtri:22b3 vscr:1d4cb vsubnE:2acb.fe00 vsubne:228a.fe00 vsupnE:2acc.fe00 vsupne:228b.fe00 vzigzag:299a wcirc:175 wedbar:2a5f wedge:2227 wedgeq:2259 weierp:2118 wfr:1d534 wopf:1d568 wp:2118 wr:2240 wreath:2240 wscr:1d4cc xcap:22c2 xcirc:25ef xcup:22c3 xdtri:25bd xfr:1d535 xhArr:27fa xharr:27f7 xi:3be xlArr:27f8 xlarr:27f5 xmap:27fc xnis:22fb xodot:2a00 xopf:1d569 xoplus:2a01 xotime:2a02 xrArr:27f9 xrarr:27f6 xscr:1d4cd xsqcup:2a06 xuplus:2a04 xutri:25b3 xvee:22c1 xwedge:22c0 yacute!:fd yacy:44f ycirc:177 ycy:44b yen!:a5 yfr:1d536 yicy:457 yopf:1d56a yscr:1d4ce yucy:44e yuml!:ff zacute:17a zcaron:17e zcy:437 zdot:17c zeetrf:2128 zeta:3b6 zfr:1d537 zhcy:436 zigrarr:21dd zopf:1d56b zscr:1d4cf zwj:200d zwnj:200c";
const HTML_SEMI = new Map();
const HTML_LEGACY = new Map();
for (const entry of HTML_TABLE.split(" ")) {
  const colon = entry.indexOf(":");
  const legacy = entry[colon - 1] === "!";
  const name = entry.slice(0, legacy ? colon - 1 : colon);
  const value = String.fromCodePoint(...entry.slice(colon + 1).split(".").map((hex) => parseInt(hex, 16)));
  HTML_SEMI.set(name, value);
  if (legacy) HTML_LEGACY.set(name, value);
}
const HTML_NAME_MAX = 32;
// HTML numeric references in 0x80-0x9F map to Windows-1252.
const C1 = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178 };

const isDec = (c) => c >= 48 && c <= 57;
const isHex = (c) => isDec(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
const isAlnum = (c) => isDec(c) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const own = (table, key) => Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

// One reference at s[at] === "&", or null. html selects HTML rules.
function readRef(s, at, html) {
  if (s.charCodeAt(at + 1) === 35) {
    let j = at + 2;
    let hex = false;
    if (s[j] === "x" || s[j] === "X") { hex = true; j += 1; }
    const digitsStart = j;
    while (j < s.length && (hex ? isHex(s.charCodeAt(j)) : isDec(s.charCodeAt(j)))) j += 1;
    // Chrome reads "&#x;" / "&#X;" (no digits) as U+FFFD; "&#;", "&#x" and
    // "&#xg;" stay literal (checked against Chrome 156).
    if (j === digitsStart && hex && html && s[j] === ";") return { ch: "\ufffd", end: j + 1 };
    if (j === digitsStart) return null;
    const semi = s[j] === ";";
    if (!semi && !html) return null;
    let k = digitsStart;
    while (k < j - 1 && s[k] === "0") k += 1;
    const n = j - k > 8 ? Infinity : parseInt(s.slice(k, j), hex ? 16 : 10);
    let cp;
    if (html) {
      if (!(n > 0 && n <= 0x10ffff) || (n >= 0xd800 && n <= 0xdfff)) cp = 0xfffd;
      else cp = C1[n] || n;
    } else {
      if (!(n > 0 && n <= 0x10ffff) || (n >= 0xd800 && n <= 0xdfff)) return null;
      cp = n;
    }
    return { ch: String.fromCodePoint(cp), end: semi ? j + 1 : j };
  }
  let j = at + 1;
  while (j < s.length && j - at <= HTML_NAME_MAX && isAlnum(s.charCodeAt(j))) j += 1;
  const name = s.slice(at + 1, j);
  if (!name) return null;
  if (!html) {
    const ch = s[j] === ";" ? own(XML_NAMED, name) : undefined;
    return ch === undefined ? null : { ch, end: j + 1 };
  }
  // Longest match, as the HTML tokenizer does: "name;" when the whole run is
  // a name followed by ";", otherwise the longest legacy prefix ("&notit;"
  // reads as "\u00acit;", "&notin;" as "\u2209", "&COPY" as "\u00a9").
  if (s[j] === ";") {
    const ch = HTML_SEMI.get(name);
    if (ch !== undefined) return { ch, end: j + 1 };
  }
  for (let k = Math.min(name.length, 6); k >= 2; k -= 1) {
    const legacy = HTML_LEGACY.get(name.slice(0, k));
    if (legacy !== undefined) return { ch: legacy, end: at + 1 + k };
  }
  return null;
}

// Decode references once. With map, the result also carries a sparse map of
// the references that were decoded (output [at, end) came from input
// [from, to)); copied text maps one to one between them. The map costs one
// Int32Array of 4 entries per "&" in the input, charged to the work budget.
function decodeRefs(s, html, map) {
  spend(s.length);
  let out = "";
  let refs = null;
  let count = 0;
  if (map) {
    let amps = 0;
    for (let k = s.indexOf("&"); k >= 0; k = s.indexOf("&", k + 1)) amps += 1;
    spend(4 * amps);
    refs = new Int32Array(4 * amps);
  }
  let i = 0;
  let last = 0;
  for (;;) {
    const amp = s.indexOf("&", i);
    if (amp < 0) break;
    const ref = readRef(s, amp, html);
    if (!ref) { i = amp + 1; continue; }
    if (amp > last) out += s.slice(last, amp);
    if (map) {
      refs[4 * count] = out.length;
      refs[4 * count + 1] = out.length + ref.ch.length;
      refs[4 * count + 2] = amp;
      refs[4 * count + 3] = ref.end;
      count += 1;
    }
    out += ref.ch;
    i = last = ref.end;
  }
  if (s.length > last) out += s.slice(last);
  return map ? { out, refs, count } : out;
}

// The input [start, end) that produced output code unit at, for one
// decodeRefs map. Binary search over the decoded references.
function sourceOf(level, at) {
  const { refs, count } = level;
  let lo = 0;
  let hi = count - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (refs[4 * mid] <= at) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0) return [at, at + 1];
  if (at < refs[4 * found + 1]) return [refs[4 * found + 2], refs[4 * found + 3]];
  const from = refs[4 * found + 3] + (at - refs[4 * found + 1]);
  return [from, from + 1];
}

// ----------------------------------------------------------------- tokenizer
const isWs = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const isNameStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 58 || c >= 0x80;
const isNameStop = (c) => isWs(c) || c === 47 || c === 62 || c === 60 || c === 61 || c === 34 || c === 39;

// A quote-aware tag at s[at] === "<". Name spans go to names (flat
// start,end pairs) and attribute value spans to values; returns the end
// index, or -1 (and the arrays are left as they were) when it is not a tag.
// Never reads past the next "<".
function readTag(s, at, names, values) {
  const n = s.length;
  const namesLength = names.length;
  const valuesLength = values.length;
  const fail = () => { names.length = namesLength; values.length = valuesLength; return -1; };
  let j = at + 1;
  const close = s.charCodeAt(j) === 47;
  if (close) j += 1;
  if (j >= n || !isNameStart(s.charCodeAt(j))) return -1;
  const nameStart = j;
  while (j < n && !isNameStop(s.charCodeAt(j))) j += 1;
  names.push(nameStart, j);
  for (;;) {
    const before = j;
    while (j < n && isWs(s.charCodeAt(j))) j += 1;
    if (j >= n) return fail();
    const c = s.charCodeAt(j);
    if (c === 62) return j + 1;
    if (c === 47 && !close && s.charCodeAt(j + 1) === 62) return j + 2;
    if (close || j === before) return fail();
    if (isNameStop(c)) return fail();
    const attrStart = j;
    while (j < n && !isNameStop(s.charCodeAt(j))) j += 1;
    names.push(attrStart, j);
    while (j < n && isWs(s.charCodeAt(j))) j += 1;
    if (s.charCodeAt(j) !== 61) return fail();
    j += 1;
    while (j < n && isWs(s.charCodeAt(j))) j += 1;
    const quote = s[j];
    if (quote !== "\"" && quote !== "'") return fail();
    j += 1;
    const valueStart = j;
    while (j < n && s[j] !== quote && s.charCodeAt(j) !== 60) j += 1;
    if (j >= n || s[j] !== quote) return fail();
    values.push(valueStart, j);
    j += 1;
  }
}

// Browser-like read of one string as XML content. Text nodes join adjacent
// character data, references and CDATA bodies (decoded, XML rules); comments
// and PIs are kept apart; a construct that does not parse is character data.
export function parseXmlText(s) {
  spend(s.length);
  const n = s.length;
  const texts = [];
  const attrs = [];
  const comments = [];
  const pis = [];
  const names = [];
  const values = [];
  let decl = false;
  let cur = null;
  let noComment = false;
  let noCdata = false;
  let noPi = false;
  // Character data copied from the source is kept as one pending range, so a
  // run of literal text costs one slice however it was tokenized.
  const add = (start, end, d, raw) => {
    if (!cur || cur.end !== start) {
      flush();
      cur = { start, end: start, parts: [], rawFrom: start };
    }
    if (!raw) {
      if (cur.rawFrom < start) cur.parts.push(s.slice(cur.rawFrom, start));
      cur.parts.push(d);
      cur.rawFrom = end;
    }
    cur.end = end;
  };
  const flush = () => {
    if (!cur) return;
    if (texts.length + attrs.length > MAX_NODES || names.length > 2 * MAX_NODES) throw new GuardLimit("guard-limit");
    if (cur.rawFrom < cur.end) cur.parts.push(s.slice(cur.rawFrom, cur.end));
    texts.push({ start: cur.start, end: cur.end, d: cur.parts.length === 1 ? cur.parts[0] : cur.parts.join("") });
    cur = null;
  };
  let i = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 60) {
      if (s.startsWith("<!--", i) && !noComment) {
        const e = s.indexOf("-->", i + 4);
        if (e >= 0) { flush(); comments.push({ start: i + 4, end: e }); i = e + 3; continue; }
        noComment = true;
      } else if (s.startsWith("<![CDATA[", i) && !noCdata) {
        const e = s.indexOf("]]>", i + 9);
        if (e >= 0) { add(i, e + 3, s.slice(i + 9, e)); i = e + 3; continue; }
        noCdata = true;
      } else if (s.startsWith("<?", i) && !noPi) {
        const e = s.indexOf("?>", i + 2);
        if (e >= 0) { flush(); pis.push({ start: i + 2, end: e }); i = e + 2; continue; }
        noPi = true;
      } else if (s.charCodeAt(i + 1) === 33 && /[A-Za-z]/.test(s[i + 2] || "")) {
        decl = true;
      } else {
        const valuesFrom = values.length;
        const end = readTag(s, i, names, values);
        if (end > 0) {
          flush();
          for (let k = valuesFrom; k < values.length; k += 2) {
            const start = values[k];
            const stop = values[k + 1];
            const raw = s.slice(start, stop).replace(/[\t\n\r]/g, " ");
            attrs.push({ start, end: stop, quote: s[stop], d: raw.includes("&") ? decodeRefs(raw, false, false) : raw });
          }
          values.length = valuesFrom;
          i = end;
          continue;
        }
      }
      add(i, i + 1, "<", true);
      i += 1;
      continue;
    }
    if (c === 38) {
      const ref = readRef(s, i, false);
      if (ref) { add(i, ref.end, ref.ch); i = ref.end; continue; }
      add(i, i + 1, "&", true);
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < n) { const cc = s.charCodeAt(j); if (cc === 60 || cc === 38) break; j += 1; }
    add(i, j, null, true);
    i = j;
  }
  flush();
  return { texts, attrs, comments, pis, names, decl, textContent: texts.map((t) => t.d).join("") };
}

// ---------------------------------------------------------------- detection
function chainHit(s, secrets, step) {
  let current = s;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const next = step(current);
    if (next === current) return false;
    if (secrets.some((secret) => next.includes(secret))) return true;
    current = next;
  }
  return false;
}
const xmlStep = (s) => (s.includes("&") ? decodeRefs(s, false, false) : s);
const htmlStep = (s) => (s.includes("&") ? decodeRefs(s, true, false) : s);

function valueHit(s, secrets) {
  if (secrets.some((secret) => s.includes(secret))) return true;
  return chainHit(s, secrets, xmlStep) || chainHit(s, secrets, htmlStep);
}

// True when any view a reader could build from s contains a secret: the raw
// string, every round of XML and HTML reference decoding, and every round of
// re-reading the text as XML (text content and attribute values), each of
// those also HTML-decoded. Every round is scanned.
// markup: "plain" (default; the whole string may be HTML), "xml" (each value
// of the XML document may be HTML) or "none" (no markup-split check).
export function anyViewContains(s, secrets, markup = "plain") {
  const list = (secrets || []).filter(long);
  if (typeof s !== "string" || s === "" || !list.length) return false;
  const outer = budget === Infinity;
  if (outer) budget = WORK_FACTOR * s.length + (1 << 20);
  try { return viewsContain(s, list, markup); } finally { if (outer) budget = Infinity; }
}

// ------------------------------------------------- HTML markup-split matcher
// The game puts each store value into innerHTML (renderMap cells on the live
// build). What the HTML parser shows from one value is that value with some
// regions hidden: every hidden region starts at real markup ("<" followed by
// a letter, "!", "/" or "?") and the shown text resumes after a ">" (comments,
// bogus comments, raw-text and RCDATA elements such as xmp, textarea, style,
// script, title, noscript, noembed, noframes, iframe, plaintext, foreign
// CDATA and quoted attributes all end on a ">"), with references decoded or
// not (raw text keeps them literal), U+0000 dropped and "<![CDATA[" / "]]>"
// dropped. A bare "<" ("SPP < 200 bar", "ROP<5") is text and hides nothing.
//
// Values are read on their own. A value continues into the next one only
// when an HTML tokenizer (state set; foreign content, script escapes and
// CDATA are branched both ways) can end the value inside markup (tag,
// attribute quote, comment, bogus comment, raw text, plaintext): then the
// page markup between the two values is swallowed and the region may close
// in the next value or in the page markup. Values that end in plain text
// never join, so neighbouring plain values (`actual` + `2281`) are not read
// as one. A hidden region stays open only while the tokenizer can still be
// inside markup; once every state is back in text it is closed. Markup that
// can reorder shown text (style, dir, class, bdo/bdi, table elements: CSS
// order and foster parenting) lets any markup-delimited piece follow any
// other: such a run is read twice over, and up to four times with table
// markup (nested foster parenting).
//
// One linear shift-and scan over all secrets at once (secrets that contain
// another secret are dropped; each kept secret is cut to a prefix so that all
// fit one 31-bit word when possible, which can only add matches), run once
// per field after redaction, with its own work budget (MATCH_WORK per input
// character); over budget fails closed (guard-limit). Values with no markup
// and no NUL are skipped. A hit is refused (credential-reflection).
const MATCH_MASK = new Int32Array(65536);
const MATCH_WORK = 24;
const RAW_TEXT = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "noscript", "textarea", "title", "plaintext"]);
const isAlpha = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const opensAt = (s, i) => { const c = s.charCodeAt(i + 1); return i + 1 >= s.length || isAlpha(c) || c === 33 || c === 47 || c === 63; };
const hasMarkup = (s) => { for (let i = s.indexOf("<"); i >= 0; i = s.indexOf("<", i + 1)) if (opensAt(s, i)) return true; return false; };
const TABLEISH = /<\/?(?:table|tbody|thead|tfoot|tr|td|th|caption|colgroup|col|template)[\s/>]/gi;
const REORDER = /style|\bdir\s*=|<bd[io]|\bclass\s*=|<\/?(?:table|tbody|thead|tfoot|tr|td|th|caption|colgroup|col|template)[\s/>]/i;

// Tokenizer states (a small subset of the HTML tokenizer; see above).
const T_DATA = 0, T_NAME = 1, T_BAN = 2, T_AN = 3, T_AAN = 4, T_BAV = 5, T_DQ = 6, T_SQ = 7, T_UNQ = 8, T_AQ = 9, T_SC = 10,
  T_COMMENT = 11, T_BOGUS = 12, T_RAW = 13, T_PLAIN = 14, T_CDATA = 15, T_UNKNOWN = 16;
const st = (k, n = "", c = -1, w = 0, start = false) => ({ k, n, c, w, start });
const ws = (c) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
function emitTag(state) {
  if (state.start && RAW_TEXT.has(state.n)) return [st(state.n === "plaintext" ? T_PLAIN : T_RAW, state.n), st(T_DATA)];
  return [st(T_DATA)];
}
function stepState(state, s, i, spendFn) {
  const c = s.charCodeAt(i);
  switch (state.k) {
    case T_DATA: {
      if (c !== 60) return null;
      if (i + 1 >= s.length) return [st(T_UNKNOWN)];
      const d = s.charCodeAt(i + 1);
      if (isAlpha(d)) return [st(T_NAME, "", -1, i + 1, true)];
      if (d === 47) {
        if (isAlpha(s.charCodeAt(i + 2))) return [st(T_NAME, "", -1, i + 2, false)];
        if (s.charCodeAt(i + 2) === 62) return [st(T_DATA, "", -1, i + 3)];
        return [st(T_BOGUS, "", -1, i + 2)];
      }
      if (d === 33) {
        if (s.startsWith("<!--", i)) return [st(T_COMMENT, "", i + 4, i + 4)];
        if (s.startsWith("<![CDATA[", i)) return [st(T_CDATA, "", -1, i + 9), st(T_BOGUS, "", -1, i + 2)];
        return [st(T_BOGUS, "", -1, i + 2)];
      }
      if (d === 63) return [st(T_BOGUS, "", -1, i + 2)];
      return null;
    }
    case T_NAME:
      if (ws(c)) return [{ ...state, k: T_BAN }];
      if (c === 47) return [{ ...state, k: T_SC }];
      if (c === 62) return emitTag(state);
      return state.n.length < 10 ? [{ ...state, n: state.n + String.fromCharCode(c >= 65 && c <= 90 ? c + 32 : c) }] : null;
    case T_BAN:
      if (ws(c)) return null;
      if (c === 47) return [{ ...state, k: T_SC }];
      if (c === 62) return emitTag(state);
      return [{ ...state, k: T_AN }];
    case T_AN:
      if (ws(c)) return [{ ...state, k: T_AAN }];
      if (c === 47) return [{ ...state, k: T_SC }];
      if (c === 61) return [{ ...state, k: T_BAV }];
      if (c === 62) return emitTag(state);
      return null;
    case T_AAN:
      if (ws(c)) return null;
      if (c === 47) return [{ ...state, k: T_SC }];
      if (c === 61) return [{ ...state, k: T_BAV }];
      if (c === 62) return emitTag(state);
      return [{ ...state, k: T_AN }];
    case T_BAV:
      if (ws(c)) return null;
      if (c === 34) return [{ ...state, k: T_DQ }];
      if (c === 39) return [{ ...state, k: T_SQ }];
      if (c === 62) return emitTag(state);
      return [{ ...state, k: T_UNQ }];
    case T_DQ: return c === 34 ? [{ ...state, k: T_AQ }] : null;
    case T_SQ: return c === 39 ? [{ ...state, k: T_AQ }] : null;
    case T_UNQ:
      if (ws(c)) return [{ ...state, k: T_BAN }];
      if (c === 62) return emitTag(state);
      return null;
    case T_AQ:
    case T_SC:
      if (ws(c)) return [{ ...state, k: T_BAN }];
      if (c === 47) return [{ ...state, k: T_SC }];
      if (c === 62) return emitTag(state);
      return [{ ...state, k: T_AN }];
    case T_COMMENT: {
      if (c !== 62) return null;
      const from = state.c;
      if (from >= 0 && (i === from || (i === from + 1 && s.charCodeAt(from) === 45))) return [st(T_DATA)];
      if (i >= 2 && i - 2 >= Math.max(from, 0) && s.startsWith("--", i - 2)) return [st(T_DATA)];
      if (i >= 3 && i - 3 >= Math.max(from, 0) && s.startsWith("--!", i - 3)) return [st(T_DATA)];
      return null;
    }
    case T_BOGUS: return c === 62 ? [st(T_DATA)] : null;
    case T_CDATA: return c === 93 && s.startsWith("]]>", i) ? [st(T_DATA, "", -1, i + 3)] : null;
    case T_RAW: {
      if (c !== 60 || s.charCodeAt(i + 1) !== 47) return null;
      const name = state.n;
      spendFn(name.length);
      if (s.slice(i + 2, i + 2 + name.length).toLowerCase() !== name) return null;
      const after = i + 2 + name.length;
      if (after < s.length && !ws(s.charCodeAt(after)) && s.charCodeAt(after) !== 47 && s.charCodeAt(after) !== 62) return null;
      // An end tag; script may be double-escaped, so it may also stay raw.
      const closed = st(T_BAN, "", -1, after, false);
      return name === "script" ? [closed, state] : [closed];
    }
    default: return null;
  }
}
// One tokenizer step over s[i] for every state in the set.
function advance(set, s, i, spendFn) {
  spendFn(set.length);
  let next = null;
  for (let j = 0; j < set.length; j += 1) {
    const state = set[j];
    const out = state.w > i ? null : stepState(state, s, i, spendFn);
    if (out === null) { if (next) next.push(state); continue; }
    if (!next) next = set.slice(0, j);
    next.push(...out);
  }
  if (next === null) return set;
  const seen = new Map();
  for (const state of next) {
    if (state.k === T_UNKNOWN) return UNKNOWN_SET;
    const key = state.k + "|" + state.n + "|" + state.c + "|" + state.w + "|" + (state.start ? 1 : 0);
    if (!seen.has(key)) seen.set(key, state);
  }
  return seen.size > 32 ? UNKNOWN_SET : [...seen.values()];
}
const UNKNOWN_SET = [st(T_UNKNOWN)];
const DATA_SET = [st(T_DATA)];
// Positions only matter inside one value.
const acrossValues = (set) => set.map((state) => ({ ...state, c: -1, w: 0 }));
// The tokenizer state set after reading s from `states`.
function tokenize(states, s, spendFn) {
  let set = states;
  for (let i = 0; i < s.length && set !== UNKNOWN_SET; i += 1) set = advance(set, s, i, spendFn);
  return acrossValues(set);
}
const endsInText = (set) => set.length === 1 && set[0].k === T_DATA;

// Patterns: drop secrets that contain another secret, then cut prefixes so
// that every kept secret fits one 31-bit word (at least 8 characters each;
// more secrets than that use more words).
function matchPacks(secrets) {
  const kept = [];
  for (const s of uniq(secrets).sort((x, y) => x.length - y.length)) if (!kept.some((t) => s.includes(t))) kept.push(s);
  const total = kept.reduce((sum, t) => sum + Math.min(t.length, 31), 0);
  const per = total <= 31 ? 31 : Math.max(8, Math.floor(31 / kept.length));
  const packs = [];
  let cur = [];
  let used = 0;
  for (const p of kept.map((t) => t.slice(0, per))) {
    if (used + p.length > 31) { packs.push(cur); cur = []; used = 0; }
    cur.push(p);
    used += p.length;
  }
  if (cur.length) packs.push(cur);
  return packs;
}

function markupSplitHit(values, secrets) {
  if (!values.some((v) => v.includes("<") || v.includes("\0"))) return false;
  if (!values.some((v) => hasMarkup(v) || v.includes("\0"))) return false;
  let total = 0;
  for (const v of values) total += v.length;
  let work = MATCH_WORK * total + (1 << 20);
  const spendFn = (n) => { work -= n; if (work < 0) throw new GuardLimit("guard-limit"); };
  // Runs of values read together.
  const runs = [];
  let run = null;
  let states = DATA_SET;
  for (let k = 0; k < values.length; k += 1) {
    const v = values[k];
    const carried = !endsInText(states);
    if (!carried) run = null;
    const markup = hasMarkup(v);
    if (!carried && !markup && !v.includes("\0")) continue;
    if (!run) { run = []; runs.push(run); }
    run.push(v);
    // The last value's end state joins nothing.
    if (k === values.length - 1) break;
    states = carried || markup ? tokenize(states, v, spendFn) : DATA_SET;
  }
  const packs = matchPacks(secrets);
  for (const r of runs) {
    let tables = 0;
    const reorder = r.some((v) => REORDER.test(v));
    if (reorder) for (const v of r) { TABLEISH.lastIndex = 0; while (tables < 2 && TABLEISH.exec(v)) tables += 1; }
    for (const pack of packs) {
      let used = 0;
      let starts = 0;
      let goal = 0;
      for (const p of pack) {
        starts |= 1 << used;
        for (let k = 0; k < p.length; k += 1) MATCH_MASK[p.charCodeAt(k)] |= 1 << (used + k);
        used += p.length;
        goal |= 1 << (used - 1);
      }
      try {
        if (shiftAnd(r, reorder ? 2 + tables : 1, reorder, starts, goal, spendFn)) return true;
      } finally {
        for (const p of pack) for (let k = 0; k < p.length; k += 1) MATCH_MASK[p.charCodeAt(k)] = 0;
      }
    }
  }
  return false;
}
function shiftAnd(values, passes, reorder, starts, goal, spendFn) {
  let d = 0;
  let skip = 0;
  let jump = 0;
  let pending = null;
  const later = (at, mask) => {
    if (!mask) return;
    if (!pending) pending = new Map();
    pending.set(at, (pending.get(at) || 0) | mask);
  };
  for (let pass = 0; pass < passes; pass += 1) {
    let set = DATA_SET;
    for (let v = 0; v < values.length; v += 1) {
      const s = values[v];
      spendFn(s.length);
      // Joined values: the page markup in between is hidden.
      if (v > 0) { d = skip | jump; set = acrossValues(set); }
      pending = null;
      const n = s.length;
      for (let i = 0; i < n; i += 1) {
        if (pending !== null) { const extra = pending.get(i); if (extra !== undefined) { d |= extra; pending.delete(i); if (!pending.size) pending = null; } }
        const c = s.charCodeAt(i);
        if (c === 60) {
          if (opensAt(s, i)) { skip |= d; if (reorder) jump |= d; }
          if (s.startsWith("<![CDATA[", i)) later(i + 9, d);
        } else if (c === 38) {
          const ref = readRef(s, i, true);
          if (ref) {
            let r = d;
            for (let k = 0; k < ref.ch.length; k += 1) { r = ((r << 1) | starts) & MATCH_MASK[ref.ch.charCodeAt(k)]; if (r & goal) return true; }
            later(ref.end, r);
          }
        } else if (c === 93 && s.startsWith("]]>", i)) {
          later(i + 3, d);
        }
        const next = ((d << 1) | starts) & MATCH_MASK[c];
        d = c === 0 ? next | d : next;
        if (d & goal) return true;
        if (c === 60 || set !== DATA_SET) {
          set = advance(set, s, i, spendFn);
          if (set.length === 1 && set[0].k === T_DATA && set[0].w <= i + 1) set = DATA_SET;
        }
        if (c === 62) {
          // Shown text may resume here; once every tokenizer state is back
          // in text, no earlier region is still open.
          d |= skip | jump;
          if (set.length === 1 && set[0].k === T_DATA) { skip = 0; set = DATA_SET; }
        }
      }
      if (pending !== null) { const tail = pending.get(n); if (tail !== undefined) d |= tail; }
    }
    // Reordering (CSS, foster parenting): text from the end may be shown
    // before the start.
    jump |= d | skip;
    d |= jump;
  }
  return false;
}

function viewsContain(s, list, markup) {
  if (valueHit(s, list)) return true;
  if (markup === "plain" && markupSplitHit([s], list)) return true;
  let current = s;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (!current.includes("<") && !current.includes("&")) return false;
    const parsed = parseXmlText(current);
    for (const attr of parsed.attrs) if (valueHit(attr.d, list)) return true;
    for (const pi of parsed.pis) if (valueHit(current.slice(pi.start, pi.end), list)) return true;
    for (const comment of parsed.comments) if (valueHit(current.slice(comment.start, comment.end), list)) return true;
    // Once per field: each text node and attribute value, in document order.
    if (round === 0 && markup === "xml") {
      const values = [...parsed.texts, ...parsed.attrs].sort((x, y) => x.start - y.start).map((item) => item.d);
      if (markupSplitHit(values, list)) return true;
    }
    const next = parsed.textContent;
    if (next === current) return false;
    if (valueHit(next, list)) return true;
    current = next;
  }
  return false;
}

// ---------------------------------------------------------------- redaction
function spansOf(text, needle) {
  const spans = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) return spans;
    spans.push([at, at + needle.length]);
    from = at + needle.length;
  }
}

// First decoding round (XML rules, then HTML rules) where the password
// appears, mapped back to spans of the input. null when none.
function deepSpans(text, password) {
  for (const html of [false, true]) {
    const levels = [];
    let current = text;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      if (!current.includes("&")) break;
      const decoded = decodeRefs(current, html, true);
      if (decoded.out === current) break;
      levels.push(decoded);
      current = decoded.out;
      const found = spansOf(current, password);
      if (!found.length) continue;
      const mapped = found.map(([a, b]) => {
        let lo = a;
        let hi = b - 1;
        for (let k = levels.length - 1; k >= 0; k -= 1) {
          lo = sourceOf(levels[k], lo)[0];
          hi = sourceOf(levels[k], hi)[1] - 1;
        }
        return [lo, hi + 1];
      }).sort((x, y) => x[0] - y[0]);
      const merged = [];
      for (const span of mapped) {
        const prev = merged[merged.length - 1];
        if (prev && span[0] <= prev[1]) prev[1] = Math.max(prev[1], span[1]);
        else merged.push(span.slice());
      }
      return merged;
    }
  }
  return null;
}

// Replace every literal or reference-encoded password in one decoded string.
function redactValue(text, password, mark) {
  let current = text;
  let count = 0;
  for (let iteration = 0; iteration < MAX_ROUNDS; iteration += 1) {
    if (current.includes(password)) {
      const parts = current.split(password);
      count += parts.length - 1;
      current = parts.join(mark);
      continue;
    }
    if (!current.includes("&")) return { out: current, count };
    const spans = deepSpans(current, password);
    if (!spans) return { out: current, count };
    // One pass: spans are sorted and disjoint.
    const parts = [];
    let last = 0;
    for (const [start, end] of spans) { parts.push(current.slice(last, start), mark); last = end; }
    parts.push(current.slice(last));
    current = parts.join("");
    count += spans.length;
  }
  if (current.includes(password) || deepSpans(current, password)) return { fail: true };
  return { out: current, count };
}

const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s, quote) => escText(s).replace(quote === "\"" ? /"/g : /'/g, quote === "\"" ? "&quot;" : "&apos;");

function redactXml(xml, parsed, password, mark) {
  for (let k = 0; k < parsed.names.length; k += 2) {
    if (xml.slice(parsed.names[k], parsed.names[k + 1]).includes(password)) return { ok: false, reason: "structural" };
  }
  for (const pi of parsed.pis) {
    if (anyViewContains(xml.slice(pi.start, pi.end), [password])) return { ok: false, reason: "credential-reflection" };
  }
  const edits = [];
  // Every edited node needs at least one slot, so more than
  // MAX_REDACTION_SLOTS edits can never be named: stop there and withhold.
  const LIMIT = 1;
  const consider = (item, value, serialize) => {
    if (!value.includes(password) && (!value.includes("&") || !valueHit(value, [password]))) return true;
    const result = redactValue(value, password, mark);
    if (result.fail) return false;
    if (result.count) {
      edits.push({ start: item.start, end: item.end, text: serialize(result.out) });
      if (edits.length > MAX_REDACTION_SLOTS) return LIMIT;
    }
    return true;
  };
  const verdict = (ok) => (ok === LIMIT ? { ok: false, reason: "slot-limit" } : { ok: false, reason: "credential-reflection" });
  for (const text of parsed.texts) { const ok = consider(text, text.d, escText); if (ok !== true) return verdict(ok); }
  for (const attr of parsed.attrs) { const ok = consider(attr, attr.d, (out) => escAttr(out, attr.quote)); if (ok !== true) return verdict(ok); }
  for (const comment of parsed.comments) {
    const ok = consider(comment, xml.slice(comment.start, comment.end), (out) => out);
    if (ok !== true) return verdict(ok);
  }
  if (!edits.length) return { ok: true, xml, ranges: [] };
  edits.sort((a, b) => a.start - b.start);
  let out = "";
  let last = 0;
  const ranges = [];
  for (const edit of edits) {
    out += xml.slice(last, edit.start);
    ranges.push([out.length, out.length + edit.text.length]);
    out += edit.text;
    last = edit.end;
  }
  out += xml.slice(last);
  for (const comment of parseXmlText(out).comments) {
    const body = out.slice(comment.start, comment.end);
    if (body.endsWith("-") || body.includes("--")) return { ok: false, reason: "credential-reflection" };
  }
  return { ok: true, xml: out, ranges };
}

// ------------------------------------------------- slot roles (redaction-slots.mjs)
// Same algorithm as netlify/lib/redaction-slots.mjs scanRoleSpans, so a slot
// named here resolves in the machine adapter, reader.py and the game bundle.
function localName(qualified) {
  const colon = String(qualified).lastIndexOf(":");
  return colon < 0 ? qualified : qualified.slice(colon + 1);
}
function roleFor(kind, elementLocal, parentLocal, attrName) {
  if (kind === "comment") return "comment";
  if (kind === "element-name") return "element-name";
  if (kind === "attribute-name") return "attribute-name";
  if (kind === "attribute-value") {
    if (attrName === "xmlns" || String(attrName).startsWith("xmlns:")) return "namespace-uri";
    const attrLocal = localName(attrName);
    if (elementLocal === "well" && attrLocal === "uid") return "well-uid";
    if (elementLocal === "wellbore" && (attrLocal === "uid" || attrLocal === "uidWell")) return "wellbore-identity";
    return "attribute-value";
  }
  if (parentLocal === "well" && elementLocal === "name") return "well-name";
  if (parentLocal === "well" && elementLocal === "field") return "well-field";
  if (parentLocal === "well" && elementLocal === "country") return "well-country";
  if (parentLocal === "logData" && elementLocal === "data") return "log-data";
  return "text";
}
function readStartTag(xml, lt, gt) {
  let i = lt + 1;
  while (i < gt && /\s/.test(xml[i])) i += 1;
  if (i >= gt) return null;
  const nameStart = i;
  while (i < gt && !/[\s/>]/.test(xml[i])) i += 1;
  const qualified = xml.slice(nameStart, i);
  if (!qualified) return null;
  const attrs = [];
  while (i < gt) {
    while (i < gt && /\s/.test(xml[i])) i += 1;
    if (i >= gt || xml[i] === "/") break;
    const attrStart = i;
    while (i < gt && xml[i] !== "=" && !/\s/.test(xml[i])) i += 1;
    if (attrStart === i) return null;
    const attrName = xml.slice(attrStart, i);
    while (i < gt && /\s/.test(xml[i])) i += 1;
    if (xml[i] !== "=") return null;
    i += 1;
    while (i < gt && /\s/.test(xml[i])) i += 1;
    const quote = xml[i];
    if (quote !== "\"" && quote !== "'") return null;
    i += 1;
    const valueStart = i;
    while (i < gt && xml[i] !== quote) i += 1;
    if (i >= gt) return null;
    attrs.push({ nameStart: attrStart, nameEnd: attrStart + attrName.length, attrName, valueStart, valueEnd: i });
    i += 1;
  }
  return { nameStart, nameEnd: nameStart + qualified.length, qualified, attrs };
}
export function scanRoleSpans(xml) {
  if (typeof xml !== "string") return null;
  const spans = [];
  const stack = [];
  let i = 0;
  const add = (start, end, kind, elementLocal, parentLocal, attrName) => {
    if (end <= start) return;
    if (kind === "text" && xml.slice(start, end).trim() === "") return;
    spans.push({ start, end, role: roleFor(kind, elementLocal, parentLocal, attrName) });
  };
  while (i < xml.length) {
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      if (end < 0) return null;
      add(i + 4, end, "comment", "", "", "");
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<?", i) || xml.startsWith("<!", i)) {
      const end = xml.startsWith("<?", i) ? xml.indexOf("?>", i + 2) : xml.indexOf(">", i + 2);
      if (end < 0) return null;
      i = end + (xml.startsWith("<?", i) ? 2 : 1);
      continue;
    }
    const lt = xml.indexOf("<", i);
    if (lt < 0) {
      const parent = stack.length > 1 ? stack[stack.length - 2].local : "";
      const current = stack.length ? stack[stack.length - 1].local : "";
      add(i, xml.length, "text", current, parent, "");
      break;
    }
    if (lt > i) {
      const parent = stack.length > 1 ? stack[stack.length - 2].local : "";
      const current = stack.length ? stack[stack.length - 1].local : "";
      add(i, lt, "text", current, parent, "");
    }
    if (xml.startsWith("</", lt)) {
      const gt = xml.indexOf(">", lt + 2);
      if (gt < 0) return null;
      let nameStart = lt + 2;
      while (nameStart < gt && /\s/.test(xml[nameStart])) nameStart += 1;
      let nameEnd = nameStart;
      while (nameEnd < gt && !/\s/.test(xml[nameEnd])) nameEnd += 1;
      add(nameStart, nameEnd, "element-name", "", "", "");
      if (stack.length) stack.pop();
      i = gt + 1;
      continue;
    }
    const gt = xml.indexOf(">", lt + 1);
    if (gt < 0) return null;
    const tag = readStartTag(xml, lt, gt);
    if (!tag) return null;
    const elementLocal = localName(tag.qualified);
    add(tag.nameStart, tag.nameEnd, "element-name", elementLocal, "", "");
    for (const attr of tag.attrs) {
      add(attr.nameStart, attr.nameEnd, "attribute-name", elementLocal, "", attr.attrName);
      add(attr.valueStart, attr.valueEnd, "attribute-value", elementLocal, "", attr.attrName);
    }
    const selfClosing = /\/\s*$/.test(xml.slice(lt + 1, gt));
    if (!selfClosing) stack.push({ local: elementLocal });
    i = gt + 1;
  }
  const seen = Object.create(null);
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  for (const span of spans) {
    seen[span.role] = (seen[span.role] || 0) + 1;
    span.ordinal = seen[span.role];
    span.id = span.role + "/" + span.ordinal;
  }
  return spans;
}

// Slot ids for the redacted ranges (sorted, disjoint), as a Set in document
// order. One merge walk over the role spans (also sorted and disjoint):
// linear in spans + ranges. null when a range has no slot role; "limit" as
// soon as more than MAX_REDACTION_SLOTS ids are needed.
function slotIds(xml, ranges) {
  const all = scanRoleSpans(xml);
  if (!all) return null;
  const spans = all.filter((span) => span.role !== "element-name" && span.role !== "attribute-name");
  const ids = new Set();
  let p = 0;
  for (const [start, end] of ranges) {
    while (p < spans.length && spans[p].end <= start) p += 1;
    let hit = false;
    for (let q = p; q < spans.length && spans[q].start < end; q += 1) {
      if (spans[q].end <= start) continue;
      hit = true;
      ids.add(spans[q].id);
      if (ids.size > MAX_REDACTION_SLOTS) return "limit";
    }
    if (!hit) return null;
  }
  return ids;
}

// ---------------------------------------------------------------- credentials
// The Basic header, strictly: canonical base64 of UTF-8 "user:password" with
// a non-empty user and password. null otherwise (callers answer 400).
export function credentialParts(auth) {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(String(auth || ""));
  if (!match) return null;
  const token = match[1];
  if (token.length % 4 !== 0) return null;
  let bytes;
  try {
    if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(token, "base64");
      if (bytes.toString("base64") !== token) return null;
    } else {
      const binary = atob(token);
      if (btoa(binary) !== token) return null;
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    }
  } catch { return null; }
  let raw;
  try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  if (/[\0\r\n]/.test(raw)) return null;
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon === raw.length - 1) return null;
  return { user: raw.slice(0, colon), password: raw.slice(colon + 1), blocking: uniq([raw, token, "Basic " + token]) };
}

// Every credential that must not come back (password first). [] when the
// header is not usable.
export function credentialSecrets(auth) {
  const parts = credentialParts(auth);
  if (!parts) return [];
  return uniq([parts.password, ...parts.blocking]).filter(long);
}

// ---------------------------------------------------------------- entry points
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const key of Object.keys(value)) { strings(key, out); strings(value[key], out); }
  return out;
}

// Per-field size cap: MAX_FIELD_CHARS, or a lower one the route passes.
function fieldCap(opts) {
  const lower = opts && Number.isInteger(opts.maxFieldChars) && opts.maxFieldChars > 0 ? opts.maxFieldChars : MAX_FIELD_CHARS;
  return Math.min(lower, MAX_FIELD_CHARS);
}

// The same fields with every string emptied (a withheld reply).
function emptied(fields) {
  const out = {};
  for (const key of Object.keys(fields || {})) out[key] = typeof fields[key] === "string" ? "" : fields[key];
  return out;
}

// Redact one reply's string fields.
//   fields: { name: string }   creds: { password, blocking: [..] }
//   opts.mark      replacement text ("[redacted]" on every route)
//   opts.xmlKeys   fields read as XML documents (others are plain text)
//   opts.slotKeys  plain-text fields that may be redacted whole, and their slot
//   opts.maxFieldChars  a lower per-field cap for this route (never above
//                  MAX_FIELD_CHARS); the Supabase fallback passes 1.5 MiB
// Returns { ok: true, fields, redacted, slots }, or { ok: false, reason }, or,
// when more than MAX_REDACTION_SLOTS slots would be needed,
// { ok: true, withheld: "slot-limit", redacted: true, slots: [], fields }
// with every field emptied (callers withhold the document). Never throws.
export function guardFields(fields, creds, opts = {}) {
  try {
    const mark = typeof opts.mark === "string" && opts.mark ? opts.mark : GAME_REDACTION_MARK;
    const xmlKeys = new Set(opts.xmlKeys || []);
    const slotKeys = opts.slotKeys || {};
    const password = long(creds && creds.password) ? creds.password : "";
    const blocking = uniq(((creds && creds.blocking) || []).filter(long));
    const all = password ? uniq([password, ...blocking]) : blocking;
    const keys = Object.keys(fields || {}).filter((key) => typeof fields[key] === "string" && fields[key] !== "");
    const cap = fieldCap(opts);
    if (keys.some((key) => fields[key].length > cap)) return { ok: false, reason: "guard-limit" };
    budget = WORK_FACTOR * keys.reduce((sum, key) => sum + fields[key].length, 0) + (4 << 20);
    if (password && mark.includes(password)) return { ok: false, reason: "credential-reflection" };
    const parsed = {};
    for (const key of keys) {
      parsed[key] = parseXmlText(fields[key]);
      if (parsed[key].decl) return { ok: false, reason: "unsafe-xml" };
    }
    // Markup splits are checked once, on the reply that would be returned.
    for (const key of keys) if (anyViewContains(fields[key], blocking, "none")) return { ok: false, reason: "credential-reflection" };
    const out = { ...fields };
    const slots = new Set();
    let limited = false;
    if (password) {
      for (const key of keys) {
        if (xmlKeys.has(key)) {
          const result = redactXml(fields[key], parsed[key], password, mark);
          if (!result.ok && result.reason === "slot-limit") { limited = true; break; }
          if (!result.ok) return { ok: false, reason: result.reason };
          if (!result.ranges.length) continue;
          const ids = slotIds(result.xml, result.ranges);
          if (ids === "limit") { limited = true; break; }
          if (!ids) return { ok: false, reason: "credential-reflection" };
          out[key] = result.xml;
          for (const id of ids) slots.add(id);
        } else {
          const result = redactValue(fields[key], password, mark);
          if (result.fail) return { ok: false, reason: "credential-reflection" };
          if (!result.count) continue;
          if (!slotKeys[key]) return { ok: false, reason: "credential-reflection" };
          out[key] = result.out;
          slots.add(slotKeys[key]);
        }
        if (slots.size > MAX_REDACTION_SLOTS) { limited = true; break; }
      }
    }
    // Over MAX_REDACTION_SLOTS: nothing is returned, so nothing is re-scanned.
    if (limited) return { ok: true, withheld: "slot-limit", redacted: true, slots: [], fields: emptied(fields) };
    for (const key of keys) parsed[key] = null;
    for (const key of keys) {
      if (anyViewContains(out[key], all, xmlKeys.has(key) ? "xml" : "plain")) return { ok: false, reason: "credential-reflection" };
      if (xmlKeys.has(key) && out[key] !== fields[key] && parseXmlText(out[key]).decl) return { ok: false, reason: "unsafe-xml" };
    }
    return { ok: true, fields: out, redacted: slots.size > 0, slots: [...slots] };
  } catch (err) {
    return { ok: false, reason: err instanceof GuardLimit ? "guard-limit" : "guard-error" };
  } finally {
    budget = Infinity;
  }
}

// Value-free redaction metadata on a game reply (same shape as the machine
// route): passwordRedacted, redactionScope "slots" and redactedSlots; over
// MAX_REDACTION_SLOTS the document is withheld (scope "response", failure
// "slot-limit").
export function attachRedactionMeta(reply, guarded) {
  if (!guarded || guarded.redacted !== true) return reply;
  reply.passwordRedacted = true;
  if (!guarded.withheld && guarded.slots.length > 0 && guarded.slots.length <= MAX_REDACTION_SLOTS) {
    reply.redactionScope = "slots";
    reply.redactedSlots = guarded.slots.slice();
    return reply;
  }
  delete reply.xml;
  delete reply.supp;
  delete reply.version;
  reply.result = -1;
  reply.redactionScope = "response";
  reply.redactionFailure = "slot-limit";
  return reply;
}

// Detection only: a GUARD_REASONS value, or null. Object keys are scanned
// too. Never throws.
export function guardReason(value, secrets, opts = {}) {
  try {
    const list = uniq((secrets || []).filter(long));
    const cap = fieldCap(opts);
    for (const text of strings(value)) {
      if (text.length > cap) return "guard-limit";
      if (parseXmlText(text).decl) return "unsafe-xml";
      if (anyViewContains(text, list)) return "credential-reflection";
    }
    return null;
  } catch (err) {
    return err instanceof GuardLimit ? "guard-limit" : "guard-error";
  } finally {
    budget = Infinity;
  }
}

// True when guardReason() would refuse.
export function echoes(value, secrets) {
  return guardReason(value, secrets) !== null;
}

// The 422 body. Fixed text; any field whose key or value would contain a
// secret is dropped, so the body never carries one.
export function echoRefusal(secrets, reason = "credential-reflection") {
  const body = { result: -1, error: "proxy refusal", code: "proxy-refusal", reason: GUARD_REASONS.includes(reason) ? reason : "credential-reflection" };
  const list = uniq((secrets || []).filter(long));
  for (const key of Object.keys(body)) {
    if (strings({ [key]: body[key] }).some((text) => anyViewContains(text, list))) delete body[key];
  }
  return strings(body).some((text) => anyViewContains(text, list)) ? {} : body;
}
