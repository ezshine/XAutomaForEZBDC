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

    const svgText = `
<svg width="${width}" height="${height}">
  <style>
    .title { 
      fill: #000; 
      font-size: 80px; 
      font-weight: bold; 
      font-family: sans-serif;
    }
  </style>
  <text 
    x="50%" 
    y="50%" 
    text-anchor="middle" 
    dominant-baseline="central" 
    class="title">${word}</text>
</svg>
    `;

    await sharp({
      create: {
        width: width,
        height: height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
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

    let text =  `每日一词：${wordItem.word}`+"\n\n"+
                    `例句：${wordItem.sampleSentences[Math.floor(Math.random()*wordItem.sampleSentences.length)].en}`+"\n\n"+
                    `查看释义：https://ezbdc.dashu.ai/query/${wordItem.word}.html`+" "+`#ez背单词`;

    return {text:text,medias:["./output.png"]};
}

main();
