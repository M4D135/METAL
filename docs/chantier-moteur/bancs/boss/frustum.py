# Visibilité des télégraphes au sol quand le joueur vise le cœur (FOV vertical 74°, œil 1,62 m).
import math
fov=74; half=fov/2; eye=1.62
print("boss scale orbit(m) pitch_core(deg) ground_visible_from(m) slam_disc_visible rocket_disc_visible")
for name,scale in [("colosse",5.4),("brise-siege",7.2),("veilleur",9.0)]:
    core_h=1.93*scale; core_fwd=.9*scale
    for orbit in [10,15,20,25]:
        horiz=max(.5,orbit-core_fwd)
        pitch=math.degrees(math.atan2(core_h-eye,horiz))
        low=pitch-half  # angle du bord inférieur de l'écran
        if low>=0: vis="aucun sol visible"; slam=rock=False
        else:
            r=eye/math.tan(math.radians(-low)); vis=f">{r:.1f} m devant"
            slam = r<4.3; rock = r<3.2+2.1
        print(name,scale,orbit,round(pitch,1),vis,slam,rock)
