// Synthetic EDM fixtures (made-up pad, NOT real data). node fixtures/mkedm.mjs → fixtures/edm_pad.xml, edm_pad.zip, edm_large.xml
import fs from 'fs';import zlib from 'zlib';
export function pad({wells=4,stations=60,extra=0}={}){const L=[`<?xml version="1.0"?>\n<export>`];const ft=m=>(m/0.3048).toFixed(3);
 L.push(`<CD_SITE site_id="S1" site_name="SYNTH PAD A (fixture)" loc_easting="500000" loc_northing="7000000"/>`);
 for(let i=0;i<wells;i++){const w='W'+(i+1);L.push(`<CD_WELL well_id="${w}" site_id="S1" well_common_name="SYN-${i+1}" offset_east="${ft(i*30)}" offset_north="0"/>`,`<CD_DATUM datum_id="D${i}" well_id="${w}" datum_name="RKB" datum_elevation="${ft(i==1?33:35)}" is_default="Y"/>`,
  `<CD_WELLBORE wellbore_id="${w}B" well_id="${w}" wellbore_name="OH"/>`,`<CD_DESIGN design_id="${w}P" wellbore_id="${w}B" design_name="Plan 1" phase="PROTOTYPE"/>`,`<CD_DESIGN design_id="${w}A" wellbore_id="${w}B" design_name="Actual" phase="ACTUAL"/>`,
  `<CD_DEFINITIVE_SURVEY_HEADER definitive_survey_id="${w}DS" design_id="${w}A" wellbore_id="${w}B" name="Definitive"/>`,`<CD_PLAN_HEADER plan_id="${w}PL" design_id="${w}P" wellbore_id="${w}B" plan_name="Plan 1"/>`);
  // W1 & W2 nudge toward each other (close approach); others fan out
  const az=[90,270,0,180,45,135,225,315][i%8],kick=i<2?(i==0?12:6):25;
  for(let k=0;k<stations;k++){const md=k*50,inc=md<600?0:Math.min(kick,(md-600)/30);L.push(`<CD_DEFINITIVE_SURVEY_STATION definitive_survey_id="${w}DS" md="${ft(md)}" inclination="${inc.toFixed(2)}" azimuth="${i==1?90:az}"/>`);
   L.push(`<CD_PLAN_STATION plan_id="${w}PL" md="${ft(md)}" inclination="${inc.toFixed(2)}" azimuth="${i==1?90:az}"/>`)}
  L.push(`<CD_ASSEMBLY assembly_id="${w}C1" wellbore_id="${w}B" string_type="Casing" assembly_name="13 3/8in Surface" od_casing="13.375" md_assembly_top="0" md_assembly_base="${ft(500)}"/>`,
   `<CD_ASSEMBLY assembly_id="${w}C2" wellbore_id="${w}B" string_type="Casing" assembly_name="9 5/8in Intermediate" od_casing="9.625" md_assembly_top="0" md_assembly_base="${ft(1500)}"/>`,
   `<CD_ASSEMBLY assembly_id="${w}BH" wellbore_id="${w}B" string_type="BHA" assembly_name="8.5in RSS"/>`,`<CD_ASSEMBLY_COMP assembly_id="${w}BH" sequence_no="1" comp_type_code="Bit" length="${ft(0.3)}" od_body="8.5"/>`,`<CD_ASSEMBLY_COMP assembly_id="${w}BH" sequence_no="2" comp_type_code="RSS" length="${ft(4.2)}" od_body="6.75"/>`,
   `<CD_TARGET target_id="${w}T" wellbore_id="${w}B" target_name="T-${i+1}" tvd="${ft(2400)}" offset_north="0" offset_east="${ft(300)}" radius="${ft(30)}"/>`)}
 for(let k=0;k<extra;k++)L.push(`<CD_AUDIT_LOG id="${k}" note="padding row ${k} &amp; filler text to make the file large"/>`);
 L.push('</export>');return L.join('\n')}
function zip(name,data){const c=zlib.deflateRawSync(data),n=Buffer.from(name),crc=zlib.crc32?zlib.crc32(data):0;
 const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(crc>>>0,14);lh.writeUInt32LE(c.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(n.length,26);
 const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(8,10);ch.writeUInt32LE(crc>>>0,16);ch.writeUInt32LE(c.length,20);ch.writeUInt32LE(data.length,24);ch.writeUInt16LE(n.length,28);ch.writeUInt32LE(0,42);
 const cd=Buffer.concat([ch,n]),off=30+n.length+c.length,e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);
 return Buffer.concat([lh,n,c,cd,e])}
if(process.argv[1]?.endsWith('mkedm.mjs')){const d=new URL('.',import.meta.url).pathname;const p=pad();fs.writeFileSync(d+'edm_pad.xml',p);fs.writeFileSync(d+'edm_pad.zip',zip('edm_pad.edm.xml',Buffer.from(p)));
 fs.writeFileSync(d+'edm_large.xml',pad({wells:8,stations:120,extra:400000}));for(const f of ['edm_pad.xml','edm_pad.zip','edm_large.xml'])console.log(f,fs.statSync(d+f).size)}
