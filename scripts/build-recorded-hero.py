"""Three recorded golf settings, edited into one native, cyclic background film."""
from pathlib import Path
import subprocess,shutil,json
from PIL import Image
root=Path(__file__).resolve().parents[1]
ff=shutil.which('ffmpeg') or str(root.parent/'video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-x86_64-v9.0.2')
source=root/'source-media/recorded-journeys';assets=root/'public/assets/brand'
assets.mkdir(exist_ok=True)
def run(args):subprocess.run([ff,'-hide_banner','-loglevel','error','-threads','4',*map(str,args)],check=True)
films=[('parkland-uk.mp4',3),('coast-mexico.mp4',7),('coast-california.mp4',4)]
args=[]
for name,start in films:args+=['-ss',str(start),'-t','7.5','-i',source/name]
filters=[]
for i,key in enumerate(['a','b','c']):filters.append(f'[{i}:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1,eq=contrast=1.04:brightness=0.012:saturation=1.12:gamma=1.03,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[{key}]')
filters+=['[a]split=2[a0][a1]','[a0][b]xfade=transition=fade:duration=1:offset=6.5[ab]','[ab][c]xfade=transition=fade:duration=1:offset=13[abc]','[abc][a1]xfade=transition=fade:duration=1:offset=19.5[cycle]','[cycle]trim=start=1:duration=19.5,setpts=PTS-STARTPTS[out]']
film=assets/'journeys-film-1080.mp4'
run([*args,'-filter_complex_threads','2','-filter_complex',';'.join(filters),'-map','[out]','-an','-c:v','libx264','-preset','medium','-crf','21','-maxrate','2800k','-bufsize','5600k','-profile:v','main','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-tune','fastdecode','-movflags','+faststart','-video_track_timescale','30000','-y',film])
first=source/'film-first-frame.png';run(['-i',film,'-frames:v','1','-y',first])
im=Image.open(first).convert('RGB')
for width in [800,1280,1920]:im.resize((width,width*1080//1920),Image.Resampling.LANCZOS).save(assets/f'journeys-poster-{width}.webp',quality=92,method=6)
im.crop((656,0,1264,1080)).save(assets/'journeys-poster-portrait.webp',quality=92,method=6)
metadata={'delivery':{'width':1920,'height':1080,'fps':30,'seconds':19.5,'bytes':film.stat().st_size,'audio':False},'shots':films,'transition':'one-second recorded-scene dissolves; cyclic edit returns to the opening frame','grade':'modest daylight contrast, shadow lift and saturation; no synthetic greens or scenery','source':'Pexels recorded footage','sources':[{'page':'https://www.pexels.com/video/scenic-coastline-golf-course-at-rancho-palos-verdes-30743320/','creator':'Logan Voss','file':'coast-california.mp4'},{'page':'https://www.pexels.com/video/scenic-aerial-view-of-lush-golf-course-and-lake-32304033/','creator':'David Pickup','file':'parkland-uk.mp4'},{'page':'https://www.pexels.com/video/hole-17-18764316/','creator':'Sergio Benitez','file':'coast-mexico.mp4'}],'license':'https://www.pexels.com/license/'}
(source/'delivery.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata['delivery']))
