# Drillship: DP hull with derrick amidships over the moonpool. Generic SIM.
from parts import *
def build():
    D = 14
    def hull(mb):
        mb.box((0, 0, D / 2 - 2), (150, 30, D + 4), 'hull'); mb.box((0, 0, 1.0), (150.2, 30.2, 2), 'hull_red')
        n = seg(3, 6, 8)
        for k in range(n):  # tapered bow
            f = k / n; mb.box((75 + 3 + f * 12, 0, D / 2 - 2 + f * 2), (6, 30 * (1 - f * .8), D + 4 - f * 2), 'hull')
        mb.box((0, 0, D + .1), (150, 30, .2), 'deck')
        mb.box((62, 0, D + 10), (16, 28, 20), 'paint_white'); mb.box((62, 0, D + 20.3), (17, 29, .6), 'paint_grey')
        for z in range(3):
            mb.box((53.9, 0, D + 4 + z * 5.5), (.1, 24, 1.4), 'glass')
        mb.cyl((80, 0, D + 22), (80, 0, D + 22.4), 10, 'paint_green', n=seg(12, 20, 28))
        mb.box((-62, 0, D + 4), (22, 26, 8), 'paint_grey')  # aft deck house
        for x in (-30, 30):
            mb.cyl((x, 13, D), (x, 13, D + 24), .6, 'paint_yellow'); mb.member((x, 13, D + 24), (x + 18, 13, D + 8), .3, 'paint_yellow')  # cranes
    comp('hull', 'hull', hull)
    comp('hull', 'sea', lambda mb: mb.box((0, 0, 3.9), (220, 90, .2), 'hull'))
    rig_floor_set(0, 0, Hs=D + 10, H=56, base=14, top=3.2, legs=4, sheaves=8, tdscale=1.3, W=18, D=18, boxy=True)
    drawworks(-4, 5, D + 10.3, 1.2)
    bop_stack(20, -6, D + 9, rams=6, s=1.0, subsea=True)
    mud_pumps(-28, -8, D, 5, 1.0, axis='x')
    mud_tanks(-30, 6, D, 3, 1.0)
    generators(-60, -10, D + 8, 4, 1.0)
    accumulator(18, 10, D, 1.0); choke(-14, -10, D, 1.0)
    pipe_handling(34, 0, D, L=30)
