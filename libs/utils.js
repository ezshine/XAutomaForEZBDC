import got from 'got';
import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import mime from 'mime-types';

function randomEmoji(text) {
    function get1emoji(){
        const start = 0x1F600;
        const end = 0x1F64F;
        const randomCodePoint = Math.floor(Math.random() * (end - start + 1)) + start;
        return String.fromCodePoint(randomCodePoint);
    }

    if(!text)return get1emoji();
    
    let fintext = text;
    const emojiCount = Math.ceil(text.length/15);
    for(let i = 0;i<emojiCount;i++){
        const chars = fintext.split('');
        chars.splice(Math.floor(Math.random()*fintext.length), 0, get1emoji());
        fintext = chars.join('');
    }

    return fintext;
}
function formatDate(date, format) {
    // 如果没有提供日期，使用当前日期
    if (!(date instanceof Date)) {
        date = new Date(date || Date.now());
    }

    const formatTokens = {
        'YYYY': date.getFullYear(),
        'YY': date.getFullYear().toString().slice(-2),
        'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
        'M': date.getMonth() + 1,
        'DD': date.getDate().toString().padStart(2, '0'),
        'D': date.getDate(),
        'HH': date.getHours().toString().padStart(2, '0'),
        'H': date.getHours(),
        'hh': (date.getHours() % 12 || 12).toString().padStart(2, '0'),
        'h': date.getHours() % 12 || 12,
        'mm': date.getMinutes().toString().padStart(2, '0'),
        'm': date.getMinutes(),
        'ss': date.getSeconds().toString().padStart(2, '0'),
        's': date.getSeconds(),
        'SSS': date.getMilliseconds().toString().padStart(3, '0'),
        'A': date.getHours() < 12 ? 'AM' : 'PM',
        'a': date.getHours() < 12 ? 'am' : 'pm',
        'ddd': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
        'dddd': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
        'MMM': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()],
        'MMMM': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()]
    };

    return format.replace(/\[([^\]]+)\]|YYYY|YY|MM?M?M?|DD?|HH?|hh?|mm?|ss?|SSS|A|a|ddd?d?/g, (match, escaped) => {
        if (escaped) return escaped;
        return formatTokens[match] || match;
    });
}

function sleep(ms=500){
    return new Promise((resolve,reject)=>{
        setTimeout(resolve,ms);
    });
}

async function downloadFile(url,ext){
    console.log("downloadFile:",url);
    
    try{
        const response = await got(url);

        // 获取内容类型
        const contentType = response.headers['content-type'];
        const extension = mime.extension(contentType); // 根据 MIME 类型获取文件扩展名

        // 如果没有扩展名，返回
        if (!extension) {
            if(ext)extension=ext;
            else{
                console.error('Could not determine file extension');
                return;
            }
        }

        // 合并目标路径和扩展名
        const hasTempDir = await exists("temp");
        console.log("hasTempDir",hasTempDir);
        if(!hasTempDir){
            await fs.mkdir("temp", { recursive: false });
        }
        const finalDestination = `temp/temp.${extension}`;
        // 使用 fs.promises.writeFile 写入文件
        await fs.writeFile(finalDestination, response.rawBody);
        
        console.log(`File downloaded successfully to ${finalDestination}`);
        return finalDestination;
    } catch (error) {
        console.error(`Download failed: ${error.message}`);
    }
}

async function downloadVideoStream(url, outputPath) {
    console.log("downloadVideoStream:",url);
    const fileStream = createWriteStream(outputPath);

    try {
        await pipeline(
            got.stream(url),
            fileStream
        );
        console.log('Download completed');
    } catch (error) {
        // 删除部分下载的文件
        await fs.unlink(outputPath).catch(() => {});
        throw new Error(`Download failed: ${error.message}`);
    } finally {
        fileStream.close();
    }
}

async function exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
}

async function cobaltApi(url){
    console.log("cobaltApi:",url);
    //https://cobalt.tools/api/json
    let res = await got.post("https://api.cobalt.tools/api/json",{
        json: {
            url
        },
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }).json();
    console.log("cobaltApi:",res);
    const hasTempDir = await exists("temp");
    console.log("hasTempDir",hasTempDir);
    if(!hasTempDir){
        await fs.mkdir("temp", { recursive: false });
    }
    await downloadVideoStream(res.url,"temp/temp.mp4");
    return "temp/temp.mp4";
}

function getByteLength(str) {
    return new TextEncoder().encode(str).length;
}

export default {
    randomEmoji,
    formatDate,
    sleep,
    downloadFile,
    cobaltApi,
    getByteLength
}