# Heli-portable rig: modular, lifts <= 4.5 t, 37 m mast. Generic SIM.
from parts import *
def build():
    ground_pad(0, 0, 64, 50)
    rig_floor_set(0, 0, Hs=5.0, H=37, base=7, top=2.2, legs=4, sheaves=6, tdscale=.85, W=10, D=9, boxy=True)
    drawworks(-3, 2.0, 5.3, .8)
    bop_stack(0, 0, 4.2, rams=2, s=.85)
    mud_pumps(16, -12, 0, 2, .8, axis='x')
    mud_tanks(-4, -13, 0, 4, .55)
    generators(14, 10, 0, 3, .7)
    accumulator(-12, 9, 0, .8); choke(7, 8, 0, .8)
    pipe_handling(0, 16, 0, L=12)
    # small modules (lift-sized) + helipad
    def mods(mb):
        for k in range(8): mb.box((-24 + (k % 4) * 3, 4 + (k // 4) * 3, .7), (2.4, 2.4, 1.4), ('paint_white', 'paint_blue', 'paint_green')[k % 3])
        mb.cyl((-24, -12, 0), (-24, -12, .2), 6, 'deck', n=seg(12, 24, 32)); mb.box((-24, -12, .22), (6, .5, .02), 'paint_white'); mb.box((-26.5, -12, .22), (.5, 5, .02), 'paint_white'); mb.box((-21.5, -12, .22), (.5, 5, .02), 'paint_white')
    comp('site', 'modules', mods)
