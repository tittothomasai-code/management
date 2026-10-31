# Semi-submersible: pontoons + columns + deck box, moored / DP. Generic SIM.
from parts import *
def build():
    D = 30
    def hull(mb):
        for y in (-22, 22): mb.box((0, y, 2.5), (90, 14, 9), 'paint_orange')
        for x in (-34, -11, 11, 34):
            for y in (-22, 22): mb.cyl((x, y, 7), (x, y, D - 4), 5.5, 'paint_orange', n=seg(10, 18, 24))
        for x in (-34, 34): mb.member((x, -16, 8), (x, 16, 8), 1.2, 'paint_orange')
        mb.box((0, 0, D - 2), (84, 64, 6), 'paint_grey'); mb.box((0, 0, D + 1.1), (84, 64, .2), 'deck')
        mb.box((-30, 18, D + 8), (20, 22, 14), 'paint_white')
        for k in range(4): mb.box((-40.1, 10 + k * 5, D + 8), (.1, 3.6, 1.2), 'glass')
        mb.box((-30, 18, D + 15.2), (20, 22, .4), 'paint_green')
        for x in (-38, 38):
            mb.cyl((x, -30, D - 6), (x, -30, D + 4), 1.4, 'paint_yellow')  # anchor fairlead/columns
        for k in range(3): mb.cyl((30 + k * 4, 22, D + 1), (30 + k * 4, 22, D + 18), .7, 'paint_white', n=seg(6, 10, 14))  # risers storage
    comp('hull', 'hull', hull)
    comp('hull', 'sea', lambda mb: mb.box((0, 0, 9.9), (150, 120, .2), 'hull'))
    rig_floor_set(0, 0, Hs=D + 8, H=48, base=12, top=3, legs=4, sheaves=7, tdscale=1.2, W=16, D=16, boxy=True)
    drawworks(-3.5, 4, D + 8.3, 1.1)
    bop_stack(16, -10, D + 7.5, rams=5, s=1.0, subsea=True)  # stack parked on the BOP deck
    mud_pumps(22, 18, D + 1, 4, 1.0, axis='x')
    mud_tanks(-10, -20, D + 1, 3, 1.0)
    generators(-36, -18, D + 1, 4, 1.0)
    accumulator(30, -2, D + 1, 1.0); choke(10, 22, D + 1, 1.0)
    pipe_handling(-20, 2, D + 1, L=24)
