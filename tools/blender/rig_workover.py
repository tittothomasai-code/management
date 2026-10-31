# Workover / pulling unit: truck-mounted telescopic mast, 31 m, 113 t. Generic SIM.
from parts import *
def build():
    ground_pad(0, 0, 50, 34)
    comp('carrier', 'truck', truck(7, 0, L=17))
    rig_floor_set(0, 0, Hs=3.0, H=31, base=2.6, top=1.4, legs=2, sheaves=4, tdscale=.6, W=6, D=5, boxy=True, open_front=False)
    drawworks(6, 0, 2.6, .6)
    bop_stack(0, 0, 2.4, rams=2, s=.65)
    mud_pumps(4, -9, 0, 1, .75, axis='x')
    mud_tanks(-8, -9, 0, 1, .8)
    generators(14, 8, 0, 1, .7)
    accumulator(-7, 6, 0, .7); choke(-1, 7, 0, .7, mgs=False)
    pipe_handling(-12, 3, 0, L=10)
