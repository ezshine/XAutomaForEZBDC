import utils from "./libs/utils.js"
import X from "./libs/x.js";
import 'dotenv/config';
import { promises as fs } from 'fs';
import got from 'got';
import sharp from 'sharp';

const isDebug = false;

async function main() {
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

    const width = 800;
    const height = 500;
    const word = wordItem.word;
    const phonetic = wordItem.britishPhonetic;
    const cates = wordItem.catetags.join(",");

    let svgText = `
<svg width="${width}" height="${height}">
  <style>
    .title { 
      fill: #235266; 
      font-size: 80px; 
      font-weight: bold; 
      font-family: verdana;
    }
    .subtitle { 
      fill: #397D99; 
      font-size: 24px; 
      font-family: verdana;
    }
    .subtitle2 { 
      fill: #397D99; 
      font-size: 16px; 
      font-family: verdana;
    }
  </style>
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
    <text 
    x="50%" 
    y="50%" 
    text-anchor="middle" 
    dominant-baseline="central" 
    class="title">${word}</text>
    <text 
    x="50%" 
    y="90%" 
    text-anchor="middle" 
    dominant-baseline="central" 
    class="subtitle2">所属分类：${cates}</text>
</svg>
    `;

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
    ])
    .png()
    .toFile('output.png')

    let sentenceIndex = Math.floor(Math.random()*wordItem.sampleSentences.length);
    let text =  `每天一个 #背单词：${wordItem.word}`+"\n\n"+
                    `例句：${wordItem.sampleSentences[sentenceIndex].en}`+"\n"+
                    `翻译：${wordItem.sampleSentences[sentenceIndex].cn}`+"\n\n"+
                    `查看详情：https://ezbdc.dashu.ai/query/${wordItem.word}.html`+"\n\n"+
                    "关注我 #学英语 其实很简单";

    return {text:text,medias:["./output.png"]};
}

main();
