import utils from "./libs/utils.js"
import X from "./libs/x.js";
import 'dotenv/config';
import { promises as fs } from 'fs';
import got from 'got';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const isDebug = false;

async function main() {
    await fs.rm("temp", { recursive: true, force: true });
    await fs.mkdir("temp", { recursive: false });
    // const hasTempDir = await utils.exists("temp");
    // if(!hasTempDir){
    //     await fs.mkdir("temp", { recursive: false });
    // }
    

    const _tweetdata = await getTweetText();
    _tweetdata.text = _tweetdata.text+utils.randomEmoji();
    console.log("tweetdata:",_tweetdata);

    // twitter
    const x = new X(
        process.env.X_CONSUMERAPIKEY,
        process.env.X_CONSUMERAPIKEYSECRET,
        process.env.X_ACCESSTOKEN,
        process.env.X_ACCESSTOKENSECRET
    );
    x.debug = isDebug;
    const aTweet = x.createTweet(_tweetdata.text);

    if(_tweetdata.medias){
        for(let i=0;i<_tweetdata.medias.length;i++){
            const mediaItem = _tweetdata.medias[i];
            await aTweet.addMedia(mediaItem);
        }
    }
    aTweet.send();

    const localdata = {
            isDebug,
            atTime:utils.formatDate(new Date(),"YYYY-MM-DD HH:mm:ss")
    };
    
    await fs.writeFile("./log.txt", JSON.stringify(localdata), "utf-8");
}

async function getTweetText(){
    let res = await got("https://engwords.ezshine.workers.dev/").json();

    for(let i =0;i<res.length;i++){
        let wordItem = res[i];

        wordItem.videos = wordItem.videos?JSON.parse(wordItem.videos):[];
        wordItem.translation = JSON.parse(wordItem.translation);
        wordItem.catetags = JSON.parse(wordItem.catetags);
        wordItem.dicttags = JSON.parse(wordItem.dicttags);
        wordItem.sampleSentences = JSON.parse(wordItem.sampleSentences);
    }

    let wordItem = res[Math.floor(Math.random()*res.length)];

    if(!wordItem.root)return await getTweetText();

    console.log(wordItem);

    const word = wordItem.word;
    const phonetic = wordItem.americanPhonetic||wordItem.britishPhonetic;
    const sampleSentences = wordItem.sampleSentences;

    let sentenceIndex = 0;
    

    let ttsText = "";
    for (let i = 0; i < 10; i++) {
        ttsText += word + ",";
    }
    // ttsText+='<break time="500ms"/>';
    //ttsText 遍历wordItem.sampleSentences，在ttsText后面加入 wordItem.sampleSentences[sentenceIndex].cn+","+wordItem.sampleSentences[sentenceIndex].en

    for (let i = 0; i < wordItem.sampleSentences.length; i++) {
        if(wordItem.sampleSentences[i].cn&&wordItem.sampleSentences[i].en){
          sentenceIndex = i;
          break;
        }
    }

    let text =  `每天一个 #背单词：${wordItem.word}`+"\n\n"+
                    (wordItem.sampleSentences.length>0?(`例句：${wordItem.sampleSentences[sentenceIndex].en}`+"\n"+
                    `翻译：${wordItem.sampleSentences[sentenceIndex].cn}`+"\n\n"):"")+
                    `查看详情：https://ezbdc.dashu.ai/query/${wordItem.word}.html`+"\n\n"+
                    "关注我，英语每天进步一点";

    const audioFile1 = await createTTSAudio(ttsText);
    const imageFile1 = await createCoverImage(wordItem);
    const videoFile1 = await compositeVideo(audioFile1,imageFile1,"./temp/video1.mp4");

    const audioFile2 = await createTTSAudio(wordItem.root);
    const imageFile2 = await createCardRootImage(word,wordItem.root);
    const videoFile2 = await compositeVideo(audioFile2,imageFile2,"./temp/video2.mp4");
    
    let videos = [videoFile1,videoFile2];

    for (let i = 0; i < wordItem.sampleSentences.length; i++) {
      if(wordItem.sampleSentences[i].cn&&wordItem.sampleSentences[i].en){
        const sentence = `例句${i+1}:${wordItem.sampleSentences[i].cn}`+"\n"+
                    `${wordItem.sampleSentences[i].en}`+"\n\n";
        const audioFile3 = await createTTSAudio(sentence);
        const imageFile3 = await createCardSentenceImage(word,sentence);
        const videoFile3 = await compositeVideo(audioFile3,imageFile3,"./temp/video"+(3+i)+".mp4");

        videos.push(videoFile3);
      }
    }

    videos.push("ending.mp4");

    const outputVideoFile = await mergeVideos(videos);

    return {text:text,medias:[outputVideoFile]};
}

async function createCoverImage(wordItem){
    const word = wordItem.word;
    const phonetic = wordItem.americanPhonetic||wordItem.britishPhonetic||"";
    const sampleSentences = wordItem.sampleSentences;

    let description = wordItem.translation[0].replace(/\[[^\]]*\]/g, '')  // 去掉中括号及其内容
    .replace(/\s+/g, '');

    const width = 1920;
    const height = 1080;

    console.log("createCoverImage");

    let svgText = `
<svg width="${width}" height="${height}">
    <style>
      .title { 
        fill: #235266; 
        font-size: 160px; 
        font-weight: bold; 
        font-family: "Noto Sans CJK SC", sans-serif;
      }
      .subtitle { 
        fill: #397D99; 
        font-size: 72px; 
        font-family: "Noto Sans CJK SC", sans-serif;
      }
        .subtitle2 { 
        fill: #397D99; 
        font-size: 48px; 
        font-weight: bold; 
        font-family: "Noto Sans CJK SC", sans-serif;
      }
    </style>
  <text 
    x="150" 
    y="100" 
    text-anchor="left" 
    dominant-baseline="central" 
    class="subtitle2">关注我，英语每天进步一点</text>
    <text 
    x="50%" 
    y="50%" 
    text-anchor="middle" 
    dominant-baseline="central" 
    class="title">${word}</text>
    <text 
    x="50%" 
    y="60%" 
    text-anchor="middle" 
    dominant-baseline="central" 
    class="subtitle">${phonetic}</text>
  </svg>
    `;

    console.log(description);

    const svg2 = `
          <svg width="1920" height="1080">
            <style>
              .text {
                fill: #397D99;
                font-size: 48px;
                font-family: "Noto Sans CJK SC", sans-serif;
              }
            </style>
            <text
              x="960" 
              y="80%" 
              text-anchor="middle" 
              dominant-baseline="central" 
              class="text"
            >${utils.addLineBreaks(description, 1500).split('<br>').map((line, i) => 
              `<tspan x="960" dy="${i === 0 ? 0 : 48 * 1.5}">${line}</tspan>`
            ).join('')}</text>
          </svg>
        `
    console.log(svg2);

    const filePath = "temp/"+Date.now()+".png";
    await sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 230, g: 240, b: 244 }
      }
    })
    .composite([
      {
        input: Buffer.from(svgText),
        top: 0,
        left: 0,
      },
      {
        input: await sharp('logo.png').resize(100, 100).toBuffer(),
        top: 30,
        left: 30,
      },
      {
        input: Buffer.from(svg2),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toFile(filePath)

    console.log(description);

    return filePath;
}
async function createCardRootImage(word,root){

  const width = 1920;
  const height = 1080;

  console.log("createCardRootImage");

  let svgText = `
<svg width="${width}" height="${height}">
  <style>
    .title { 
      fill: #235266; 
      font-size: 120px; 
      font-weight: bold; 
      font-family: "Noto Sans CJK SC", sans-serif;
    }
    .subtitle { 
      fill: #397D99; 
      font-size: 72px; 
      font-family: "Noto Sans CJK SC", sans-serif;
    }
      .subtitle2 { 
      fill: #397D99; 
      font-size: 48px; 
      font-weight: bold; 
      font-family: "Noto Sans CJK SC", sans-serif;
    }
  </style>
<text 
  x="150" 
  y="100" 
  text-anchor="left" 
  dominant-baseline="central" 
  class="subtitle2">关注我，英语每天进步一点</text>
  <text 
    x="50%" 
    y="35%" 
    text-anchor="middle" 
    dominant-baseline="central" 
    class="title">${word}</text>
  </svg>
  `;

  const filePath = "temp/"+Date.now()+".png";
  await sharp({
    create: {
      width: width,
      height: height,
      channels: 3,
      background: { r: 230, g: 240, b: 244 }
    }
  })
  .composite([
    {
      input: Buffer.from(svgText),
      top: 0,
      left: 0,
    },
    {
      input: await sharp('logo.png').resize(100, 100).toBuffer(),
      top: 30,
      left: 30,
    },
    {
      input: Buffer.from(`
        <svg width="1920" height="1080">
          <style>
            .text {
              fill: #235266;
              font-size: 48px;
              font-family: "Noto Sans CJK SC", sans-serif;
            }
          </style>
          <text
            x="960"
            y="50%"
            text-anchor="middle" 
            dominant-baseline="central" 
            class="text"
          >${utils.addLineBreaks(root.replace(/\*/g, ''), 1500).split('<br>').map((line, i) => 
            `<tspan x="960" dy="${i === 0 ? 0 : 48 * 1.5}px">${line}</tspan>`
          ).join('')}</text>
        </svg>
      `),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(filePath)

  return filePath;
}
async function createCardSentenceImage(word,sentence){

  const width = 1920;
  const height = 1080;

  console.log("createCardSentenceImage");

  let svgText = `
<svg width="${width}" height="${height}">
  <style>
    .title { 
      fill: #235266; 
      font-size: 160px; 
      font-weight: bold; 
      font-family: "Noto Sans CJK SC", sans-serif;
    }
    .subtitle { 
      fill: #397D99; 
      font-size: 72px; 
      font-family: "Noto Sans CJK SC", sans-serif;
    }
      .subtitle2 { 
      fill: #397D99; 
      font-size: 48px; 
      font-weight: bold; 
      font-family: "Noto Sans CJK SC", sans-serif;
    }
  </style>
<text 
  x="150" 
  y="100" 
  text-anchor="left" 
  dominant-baseline="central" 
  class="subtitle2">关注我，英语每天进步一点</text>
  </svg>
  `;

  const filePath = "temp/"+Date.now()+".png";
  await sharp({
    create: {
      width: width,
      height: height,
      channels: 3,
      background: { r: 230, g: 240, b: 244 }
    }
  })
  .composite([
    {
      input: Buffer.from(svgText),
      top: 0,
      left: 0,
    },
    {
      input: await sharp('logo.png').resize(100, 100).toBuffer(),
      top: 30,
      left: 30,
    },
    {
      input: Buffer.from(`
        <svg width="1920" height="1080">
          <style>
            .text {
              fill: #235266;
              font-size: 48px;
              font-family: "Noto Sans CJK SC", sans-serif;
            }
          </style>
          <text
            x="960"
            y="45%"
            text-anchor="middle" 
            dominant-baseline="central" 
            class="text"
          >${utils.addLineBreaks(sentence, 1500).split('<br>').map((line, i) => 
            `<tspan x="960" dy="${i === 0 ? 0 : 48 * 1.5}px">${line}</tspan>`
          ).join('')}</text>
        </svg>
      `),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(filePath)

  return filePath;
}

async function createTTSAudio(text){
  //使用 got 发起一个 get 请求，请求地址 https://tts.dashu.ai/v1/audio/speech
  //请求参数 input ,voice
  //响应体为 mp3 格式的音频，下载至本地命名为 tts.mp3

  const url = 'https://tts.dashu.ai/v1/audio/speech';
  const filePath = "temp/"+Date.now()+".mp3";
  try {
      await utils.downloadFile(`${url}?input=${text}&voice=zh-CN-XiaoxiaoNeural&pitch=-10&rate=-10`,filePath);
  } catch (error) {
      console.error('Error:', error); 
  }
  
  return filePath;
}

// 将多个视频合并成一个
async function mergeVideos(videos){
  //使用 ffmpeg 将 videos 合并成 mp4 格式的视频，下载至本地命名为 video.mp4
  //需要实现为 await
  console.log("准备合成最终的视频");
  const filePath = "video.mp4";
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    videos.forEach(video => command.input(video));
    command.on('end', () => {
      console.log('视频合成完成');
      resolve(filePath);
    })
    .on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    })
    .mergeToFile(filePath, './temp');
  });
}


async function compositeVideo(audioFile, imageFile, outputFile) {
  const audioInfo = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioFile, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
  const audioDuration = audioInfo.format.duration;
  const videoDuration = audioDuration + 1;  // 视频持续时间比音频多1秒

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(audioFile)
      .input(imageFile)
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-vf', `scale=trunc(iw/2)*2:trunc(ih/2)*2,loop=999999:1:0`,
        '-t', videoDuration,
      ])
      .output(outputFile)
      .on('end', () => {
        console.log('视频合成完成');
        resolve();
      })
      .on('error', (error) => {
        console.error('视频合成失败', error);
        reject(error);
      })
      .run();
  });

  return outputFile;
}

main();