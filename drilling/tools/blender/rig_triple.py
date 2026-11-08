# Land rig — triple (43 m derrick, 340 t, 1,500 hp). Generic SIM.
from parts import *
def build():
    ground_pad(0, 0, 80, 56)
    rig_floor_set(0, 0, Hs=7.5, H=43, base=9, top=2.6, legs=4, sheaves=7, tdscale=1.0, W=12, D=11)
    drawworks(-3.2, 2.5, 7.8, .9)
    bop_stack(0, 0, 6.6, rams=3, s=1.0)
    mud_pumps(20, -14, 0, 2, 1.0, axis='x')
    mud_tanks(-2, -15, 0, 3, 1.0)
    generators(18, 12, 0, 3, 1.0)
    accumulator(-14, 10, 0); choke(9, 9, 0)
    pipe_handling(0, 20, 0, L=18)
