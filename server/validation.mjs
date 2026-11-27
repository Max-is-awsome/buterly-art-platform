import {z} from 'zod';
export const artworkSchema=z.object({showArtist:z.boolean().default(false),title:z.string().trim().min(1).max(160),medium:z.enum(['Visual art','Photography','Music','Writing','Film','3D art','Mixed media']),statement:z.string().max(3000).default(''),text:z.string().max(50000).default(''),parents:z.array(z.number().int().nonnegative()).min(1).max(8).transform(x=>[...new Set(x)]),url:z.string().max(14000000).optional(),mime:z.enum(['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','video/mp4','video/webm']).optional()}).refine(x=>x.text.trim()||x.url,{message:'Add artwork before publishing'}).refine(x=>!x.url||!!x.mime,{message:'Media type is required'});
export function decodeMedia(url,mime){const prefix=`data:${mime};base64,`;if(!url.startsWith(prefix))throw Error('Invalid media encoding');const data=url.slice(prefix.length);if(!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('Invalid media encoding');const bytes=Buffer.from(data,'base64');if(!bytes.length||bytes.length>10*1024*1024)throw Error('Media must be under 10 MB');const hex=bytes.subarray(0,12).toString('hex');const ascii=bytes.subarray(0,12).toString('ascii');const valid=mime==='image/png'?hex.startsWith('89504e470d0a1a0a'):mime==='image/jpeg'?hex.startsWith('ffd8ff'):mime==='image/webp'?ascii.startsWith('RIFF')&&ascii.endsWith('WEBP'):mime==='audio/wav'?ascii.startsWith('RIFF')&&ascii.endsWith('WAVE'):mime==='video/mp4'?ascii.slice(4,8)==='ftyp':mime==='video/webm'?hex.startsWith('1a45dfa3'):ascii.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224);if(!valid)throw Error('File contents do not match media type');return bytes}

function socialLink(domain, path) {
  return z.string().trim().max(500).transform((value, ctx) => {
    if (!value) return undefined;
    const url = URL.parse(value.includes('://') ? value : 'https://' + value);
    if (url?.protocol === 'https:' && !url.username && !url.password && !url.port &&
        [domain, 'www.' + domain].includes(url.hostname) && path.test(url.pathname)) {
      return 'https://www.' + domain + url.pathname;
    }
    ctx.addIssue({code: 'custom', message: 'Enter a ' + domain + ' profile link.'});
    return z.NEVER;
  }).optional();
}

export const profileSchema = z.object({
  displayName: z.string().trim().max(48),
  bio: z.string().trim().max(280),
  links: z.object({
    linkedin: socialLink('linkedin.com', /^\/(in|company)\/[^/]+\/?$/),
    instagram: socialLink('instagram.com', /^\/[\w.]+\/?$/),
    youtube: socialLink('youtube.com', /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)(?:\/(?:featured|videos|shorts|streams|playlists|community|about))?\/?$/),
    pinterest: socialLink('pinterest.com', /^\/[\w-]+\/?$/)
  }).strict().optional()
}).strict().refine(({displayName, bio, links}) =>
  displayName || (!bio && !Object.values(links ?? {}).some(Boolean)), {
  message: 'Add an artist name before saving a bio or links.'
});
