/**
 * 项目名称: X
 * 描述: 本项目用于方便快捷的使用 JavaScript 来发送推特。
 * 
 * 作者: ezshine
 * GitHub: https://github.com/ezshine
 * 版本: 1.0.0
 * 日期: 2024-08-31
 * 许可证: GPL v3.0
 */

import { promises as fs } from 'fs';
import { FormData } from 'formdata-node';
import got from 'got';
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import path from 'path';
import utils from './utils.js';

class X
{
    debug = false;  //if debug = true, so it dosn't send finally data to Twitter Api
    constructor(consumerApiKey,consumerApiKeySecret,accessToken,accessTokenSecret){
        this.consumerApiKey = consumerApiKey;
        this.consumerApiKeySecret = consumerApiKeySecret;
        this.accessToken = accessToken;
        this.accessTokenSecret = accessTokenSecret;

        if(!consumerApiKey||!consumerApiKeySecret||!accessToken||!accessTokenSecret)throw new Error("you have to set consumerApiKey,consumerApiKeySecret,accessToken,accessTokenSecret");

        // create OAuth
        this.oauth = new OAuth({
            consumer: { key: this.consumerApiKey, secret: this.consumerApiKeySecret },
            signature_method: 'HMAC-SHA1',
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha1', key)
                    .update(base_string)
                    .digest('base64');
            },
        });
    }
    // get every twitter api need;
    #getAuthHeader(url, method, data={}) {
        const request_data = { 
            url, 
            method,
            data
        };
        const token = { key: this.accessToken, secret: this.accessTokenSecret };
        
        return this.oauth.toHeader(this.oauth.authorize(request_data, token));
    }
    // when add video to tweet must waiting media proccessing;
    async #waitForMediaProcessing(mediaId) {
        const url = `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`;
        let processingInfo;
        do {
          const response = await got.get(url, {
            headers: this.#getAuthHeader(url, 'GET'),
          }).json();
          processingInfo = response.processing_info;
          console.log('Processing status:', processingInfo?.state);
          if (processingInfo?.state === 'failed') {
            throw new Error(`Media processing failed: ${processingInfo.error.message}`);
          }
          if (processingInfo?.state !== 'succeeded') {
            // 等待建议的时间后再次检查
            await new Promise(resolve => setTimeout(resolve, (processingInfo?.check_after_secs || 5) * 1000));
          }
        } while (processingInfo && processingInfo.state !== 'succeeded');
    }
    // create a tweet sender;
    createTweet(text=""){
        let data = {
            text
        }

        return {
            data,
            // set tweet text content
            setText(text=""){
                data.text = text;
                return this;
            },
            // add Image or Video to tweet sender
            addMedia:async(mediaPath)=>{
                if(mediaPath.indexOf("http")>=0){
                    mediaPath=await utils.downloadFile(mediaPath);
                }

                const url = 'https://upload.twitter.com/1.1/media/upload.json';
                const mediaType = path.extname(mediaPath).toLowerCase() === '.mp4' ? 'video/mp4' : 'image/jpeg';
                const mediaData = await fs.readFile(mediaPath);
                
                let mediaId;
                if(!this.debug){
                    if (mediaType === 'image/jpeg') {
                        // 图片上传
                        const form = new FormData();
                        form.append('media', new Blob([mediaData]), {
                            filename: path.basename(mediaPath),
                            contentType: mediaType,
                        });

                        const response = await got.post(url, {
                            body: form,
                            headers: {
                                ...this.#getAuthHeader(url, 'POST'),
                            },
                        }).json();

                        mediaId = response.media_id_string;
                    } else {
                        // 视频上传
                        // INIT
                        let form = {
                            command: 'INIT',
                            total_bytes: mediaData.length,
                            media_type: mediaType,
                        }
                        const initResponse = await got.post(url, {
                            form,
                            headers: this.#getAuthHeader(url, 'POST',form),
                        }).json();

                        mediaId = initResponse.media_id_string;
                        // APPEND
                        const chunkSize = 5 * 1024 * 1024; // 5MB chunks
                        for (let i = 0; i < mediaData.length; i += chunkSize) {
                            const chunk = mediaData.slice(i, i + chunkSize);
                            const form = new FormData();
                            form.append('command', 'APPEND');
                            form.append('media_id', mediaId);
                            form.append('segment_index', Math.floor(i / chunkSize));
                            form.append('media', new Blob([chunk]), {
                                filename: 'chunk',
                                contentType: mediaType,
                            });

                            await got.post(url, {
                                body: form,
                                headers: this.#getAuthHeader(url, 'POST'),
                            });
                        }

                        // FINALIZE
                        form = {
                            command: 'FINALIZE',
                            media_id: mediaId
                        }
                        const finalizeResponse = await got.post(url, {
                            form,
                            headers: this.#getAuthHeader(url, 'POST', form),
                        }).json();

                        // 等待媒体处理完成
                        if (finalizeResponse.processing_info) {
                            await this.#waitForMediaProcessing(mediaId);
                        }
                    }
                }else{
                    mediaId=mediaPath
                }

                if(!data.media)data.media={media_ids:[]};
                data.media.media_ids.unshift(mediaId);

                return mediaId;
            },
            // post data to twitter api
            send:async()=>{
                const url = 'https://api.twitter.com/2/tweets';
                const options = {
                    json: data,
                    headers: {
                        ...this.#getAuthHeader(url, 'POST'),
                        'Content-Type': 'application/json',
                    },
                }
                console.log(JSON.stringify(options));
                
                if(this.debug)return;
                try {
                    const response = await got.post(url,options).json();

                    console.log('Tweet created:', response);
                    return response;
                } catch (error) {
                    if (error.response) {
                        console.error('Error response:', error.response.body);
                        console.error('Error status:', error.response.statusCode);
                    } else {
                        console.error('Error message:', error.message);
                    }
                    // throw error;
                }
            }
        }
    }
}

export default X;