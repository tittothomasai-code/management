# Jack-up: bottom-supported, 3 lattice legs, cantilever drilling package. Generic SIM.
from parts import *
def build():
    D = 22  # deck elevation above sea level
    def hull(mb):
        mb.box((0, 0, D - 3), (46, 40, 6), 'hull_red')
        mb.box((0, 0, D + .1), (46, 40, .2), 'deck')
        mb.box((-14, 12, D + 6), (14, 12, 12), 'paint_white')  # accommodation
        for k in range(3): mb.box((-20.6, 12 - 4 + k * 4, D + 6), (.1, 8, 1.2), 'glass')
        mb.box((-14, 12, D + 12.2), (16, 14, .4), 'paint_green'); mb.cyl((-14, 12, D + 12.4), (-14, 12, D + 12.5), 6, 'paint_green', n=seg(12, 20, 28))
        mb.box((12, 0, D + 3), (14, 14, 6), 'paint_grey')  # cantilever
    comp('hull', 'hull', hull)
    def legs(mb):
        for x, y in ((-19, -17), (19, -17), (0, 17)):
            for a, c in ((-1, -1), (1, -1), (1, 1), (-1, 1)): mb.member((x + a * 2.4, y + c * 2.4, -10), (x + a * 2.4, y + c * 2.4, D + 30), .35, 'paint_yellow')
            nb = seg(6, 16, 24)
            for k in range(nb):
                z0, z1 = -10 + (D + 40) * k / nb, -10 + (D + 40) * (k + 1) / nb
                for i in range(4):
                    p = [(-1, -1), (1, -1), (1, 1), (-1, 1)]; a, c = p[i]; b2, d2 = p[(i + 1) % 4]
                    mb.member((x + a * 2.4, y + c * 2.4, z1), (x + b2 * 2.4, y + d2 * 2.4, z1), .14, 'paint_yellow')
                    if LOD: mb.member((x + a * 2.4, y + c * 2.4, z0), (x + b2 * 2.4, y + d2 * 2.4, z1), .1, 'paint_yellow')
            mb.box((x, y, D + 1), (8, 8, 4), 'paint_grey')  # jack house
    comp('hull', 'legs', legs)
    comp('hull', 'sea', lambda mb: mb.box((0, 0, -.1), (120, 110, .2), 'hull'))
    rig_floor_set(14, 0, Hs=D + 6, H=46, base=9, top=2.8, legs=4, sheaves=7, tdscale=1.1, W=12, D=12, boxy=True)
    drawworks(11, 3, D + 6.3, 1.0)
    bop_stack(14, 0, D + 5, rams=4, s=1.0)
    mud_pumps(-6, -12, D, 3, 1.0, axis='x')
    mud_tanks(-4, 0, D, 2, 1.0)
    generators(-20, -12, D, 3, .9)
    accumulator(2, 14, D, .9); choke(4, -8, D, .9)
    pipe_handling(-2, 6, D, L=18, rack=True)
