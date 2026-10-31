# Land rig — single (A-frame mast, ~26 m, 136 t). Generic SIM.
from parts import *
def build():
    ground_pad(0, 0, 60, 40)
    rig_floor_set(0, 0, Hs=3.2, H=26, base=3.4, top=1.6, legs=2, sheaves=4, tdscale=.75, W=8, D=7)
    drawworks(-2.6, 0, 3.5, .7)
    bop_stack(0, 0, 2.6, rams=2, s=.75)
    mud_pumps(14, -10, 0, 1, .8)
    mud_tanks(0, -11, 0, 2, .8)
    generators(14, 9, 0, 2, .8)
    accumulator(-8, 8, 0, .8); choke(6, 7, 0, .8)
    pipe_handling(0, 12, 0, L=12)
