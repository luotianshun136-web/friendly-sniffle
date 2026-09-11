import {readFile,writeFile,mkdir,access} from "node:fs/promises";
import {randomBytes,randomUUID} from "node:crypto";
import {hashPassword} from "better-auth/crypto";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";
import path from "node:path";

const directory=path.resolve("test-results/media-qa");
let exists=false;try{await access(path.join(directory,"credentials.json"));exists=true}catch(error){if(error.code!=="ENOENT")throw error}
if(exists)throw new Error("Local fixtures already exist; reuse them. No data was overwritten.");
await mkdir(directory,{recursive:true});
const build=JSON.parse(await readFile("dist/server/wrangler.json","utf8")),password=randomBytes(24).toString("base64url"),hash=await hashPassword(password),origin="http://127.0.0.1:5174";
const config={name:"capone-media-local-qa",main:"../../dist/server/index.js",compatibility_date:build.compatibility_date,compatibility_flags:build.compatibility_flags,no_bundle:true,rules:build.rules,assets:{...build.assets,directory:"../../dist/client"},d1_databases:[{binding:"DB",database_name:"capone-media-local-qa",database_id:"00000000-0000-4000-8000-000000000018"}],r2_buckets:[{binding:"BUCKET",bucket_name:"capone-media-local-qa"}]};
await writeFile(path.join(directory,"wrangler.json"),JSON.stringify(config,null,2));
await writeFile(path.join(directory,".dev.vars"),`SITE_ORIGIN=${JSON.stringify(origin)}\nBETTER_AUTH_SECRET=${JSON.stringify(randomBytes(48).toString("base64url"))}\n`,{mode:0o600});
await writeFile(path.join(directory,"credentials.json"),JSON.stringify({origin,username:"capone",password}),{mode:0o600});
const journal=JSON.parse(await readFile("drizzle/meta/_journal.json","utf8"));
const migrations=[];for(const entry of journal.entries)migrations.push(await readFile("drizzle/"+entry.tag+".sql","utf8"));
const now=Date.now(),literal=value=>"'"+String(value).replaceAll("'","''")+"'";
await writeFile(path.join(directory,"seed.sql"),migrations.join("\n")+`
INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,username,displayUsername,mustChangePassword) VALUES ('capone-owner','Local QA','qa@capone.invalid',0,${now},${now},'capone','capone',0);
INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (${literal(randomUUID())},'capone-owner','credential','capone-owner',${literal(hash)},${now},${now});
INSERT INTO media (id,storageKey,mime,kind,width,height,size,createdAt) VALUES ('qa-topic-media','@hero','video/mp4','video',720,1280,3368662,${now});
INSERT INTO posts (id,title,body,mediaId,status,createdAt,updatedAt) VALUES ('qa-topic-post','Local QA published post','Synthetic test data','qa-topic-media','published',${now},${now});
INSERT INTO posts (id,title,body,mediaId,status,createdAt,updatedAt) VALUES ('qa-topic-draft','Local QA private draft','Synthetic test data','qa-topic-media','draft',${now},${now});
`,{mode:0o600});
const sharp=createRequire(import.meta.url)("sharp");
for(const [name,width,height,color] of [["portrait",540,960,"#825969"],["landscape",960,540,"#3d6262"],["wrong-ratio",640,480,"#616666"]])await sharp({create:{width,height,channels:3,background:color}}).webp().toFile(path.join(directory,name+".webp"));
const ffmpeg=path.resolve(".private/tools/ffmpeg/package/ffmpeg.exe");
const result=spawnSync(ffmpeg,["-hide_banner","-loglevel","error","-y","-f","lavfi","-i","color=c=0x3d6262:s=640x360:r=15:d=1","-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",path.join(directory,"landscape.mp4")],{encoding:"utf8",windowsHide:true});
if(result.status!==0)throw new Error(result.stderr||"Cannot create local test video");
console.log("Prepared LOCAL media fixtures only. Production resources were not used.");
