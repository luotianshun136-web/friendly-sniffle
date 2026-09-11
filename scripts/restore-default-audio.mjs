import {readFileSync,writeFileSync} from "node:fs";
import {Input,BufferSource,ALL_FORMATS,Output,Mp4OutputFormat,BufferTarget,EncodedPacketSink,EncodedVideoPacketSource,EncodedAudioPacketSource} from "mediabunny";
const videoInput=new Input({source:new BufferSource(readFileSync("public/media/hero-v2.mp4")),formats:ALL_FORMATS});
const originalInput=new Input({source:new BufferSource(readFileSync("public/hero.mp4")),formats:ALL_FORMATS});
try{
 const video=await videoInput.getPrimaryVideoTrack(),audio=await originalInput.getPrimaryAudioTrack();
 if(!video||audio?.codec!=="aac")throw new Error("Expected the original AAC track");
 const target=new BufferTarget(),output=new Output({format:new Mp4OutputFormat({fastStart:"in-memory"}),target}),vs=new EncodedVideoPacketSource("avc"),as=new EncodedAudioPacketSource("aac");
 output.addVideoTrack(vs);output.addAudioTrack(as);await output.start();
 const vc=await video.getDecoderConfig(),ac=await audio.getDecoderConfig();
 for await(const packet of new EncodedPacketSink(video).packets())await vs.add(packet,{decoderConfig:vc});
 for await(const packet of new EncodedPacketSink(audio).packets())await as.add(packet,{decoderConfig:ac});
 vs.close();as.close();await output.finalize();writeFileSync("public/media/hero-v3.mp4",Buffer.from(target.buffer));
 console.log(JSON.stringify({bytes:target.buffer.byteLength,width:video.displayWidth,height:video.displayHeight,duration:await video.computeDuration(),audioCodec:audio.codec}));
}finally{videoInput.dispose();originalInput.dispose()}
