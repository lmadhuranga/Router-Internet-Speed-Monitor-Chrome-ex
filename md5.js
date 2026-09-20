(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RouterMD5 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  function rol(x, c) { return (x << c) | (x >>> (32 - c)); }
  function cmn(q, a, b, x, s, t) { return add32(rol(add32(add32(a, q), add32(x, t)), s), b); }
  function ff(a,b,c,d,x,s,t){ return cmn((b & c) | ((~b) & d), a,b,x,s,t); }
  function gg(a,b,c,d,x,s,t){ return cmn((b & d) | (c & (~d)), a,b,x,s,t); }
  function hh(a,b,c,d,x,s,t){ return cmn(b ^ c ^ d, a,b,x,s,t); }
  function ii(a,b,c,d,x,s,t){ return cmn(c ^ (b | (~d)), a,b,x,s,t); }

  function toUtf8Bytes(str) {
    return Array.from(new TextEncoder().encode(String(str)));
  }

  function md5(input) {
    const bytes = toUtf8Bytes(input);
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    const low = bitLen >>> 0;
    const high = Math.floor(bitLen / 0x100000000) >>> 0;
    for (let i = 0; i < 4; i++) bytes.push((low >>> (8*i)) & 0xff);
    for (let i = 0; i < 4; i++) bytes.push((high >>> (8*i)) & 0xff);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (let offset = 0; offset < bytes.length; offset += 64) {
      const M = new Array(16);
      for (let i = 0; i < 16; i++) {
        const j = offset + i * 4;
        M[i] = (bytes[j]) | (bytes[j+1] << 8) | (bytes[j+2] << 16) | (bytes[j+3] << 24);
      }
      let a=a0,b=b0,c=c0,d=d0;

      a=ff(a,b,c,d,M[0],7,-680876936); d=ff(d,a,b,c,M[1],12,-389564586); c=ff(c,d,a,b,M[2],17,606105819); b=ff(b,c,d,a,M[3],22,-1044525330);
      a=ff(a,b,c,d,M[4],7,-176418897); d=ff(d,a,b,c,M[5],12,1200080426); c=ff(c,d,a,b,M[6],17,-1473231341); b=ff(b,c,d,a,M[7],22,-45705983);
      a=ff(a,b,c,d,M[8],7,1770035416); d=ff(d,a,b,c,M[9],12,-1958414417); c=ff(c,d,a,b,M[10],17,-42063); b=ff(b,c,d,a,M[11],22,-1990404162);
      a=ff(a,b,c,d,M[12],7,1804603682); d=ff(d,a,b,c,M[13],12,-40341101); c=ff(c,d,a,b,M[14],17,-1502002290); b=ff(b,c,d,a,M[15],22,1236535329);

      a=gg(a,b,c,d,M[1],5,-165796510); d=gg(d,a,b,c,M[6],9,-1069501632); c=gg(c,d,a,b,M[11],14,643717713); b=gg(b,c,d,a,M[0],20,-373897302);
      a=gg(a,b,c,d,M[5],5,-701558691); d=gg(d,a,b,c,M[10],9,38016083); c=gg(c,d,a,b,M[15],14,-660478335); b=gg(b,c,d,a,M[4],20,-405537848);
      a=gg(a,b,c,d,M[9],5,568446438); d=gg(d,a,b,c,M[14],9,-1019803690); c=gg(c,d,a,b,M[3],14,-187363961); b=gg(b,c,d,a,M[8],20,1163531501);
      a=gg(a,b,c,d,M[13],5,-1444681467); d=gg(d,a,b,c,M[2],9,-51403784); c=gg(c,d,a,b,M[7],14,1735328473); b=gg(b,c,d,a,M[12],20,-1926607734);

      a=hh(a,b,c,d,M[5],4,-378558); d=hh(d,a,b,c,M[8],11,-2022574463); c=hh(c,d,a,b,M[11],16,1839030562); b=hh(b,c,d,a,M[14],23,-35309556);
      a=hh(a,b,c,d,M[1],4,-1530992060); d=hh(d,a,b,c,M[4],11,1272893353); c=hh(c,d,a,b,M[7],16,-155497632); b=hh(b,c,d,a,M[10],23,-1094730640);
      a=hh(a,b,c,d,M[13],4,681279174); d=hh(d,a,b,c,M[0],11,-358537222); c=hh(c,d,a,b,M[3],16,-722521979); b=hh(b,c,d,a,M[6],23,76029189);
      a=hh(a,b,c,d,M[9],4,-640364487); d=hh(d,a,b,c,M[12],11,-421815835); c=hh(c,d,a,b,M[15],16,530742520); b=hh(b,c,d,a,M[2],23,-995338651);

      a=ii(a,b,c,d,M[0],6,-198630844); d=ii(d,a,b,c,M[7],10,1126891415); c=ii(c,d,a,b,M[14],15,-1416354905); b=ii(b,c,d,a,M[5],21,-57434055);
      a=ii(a,b,c,d,M[12],6,1700485571); d=ii(d,a,b,c,M[3],10,-1894986606); c=ii(c,d,a,b,M[10],15,-1051523); b=ii(b,c,d,a,M[1],21,-2054922799);
      a=ii(a,b,c,d,M[8],6,1873313359); d=ii(d,a,b,c,M[15],10,-30611744); c=ii(c,d,a,b,M[6],15,-1560198380); b=ii(b,c,d,a,M[13],21,1309151649);
      a=ii(a,b,c,d,M[4],6,-145523070); d=ii(d,a,b,c,M[11],10,-1120210379); c=ii(c,d,a,b,M[2],15,718787259); b=ii(b,c,d,a,M[9],21,-343485551);

      a0=add32(a0,a); b0=add32(b0,b); c0=add32(c0,c); d0=add32(d0,d);
    }

    function hex(n) {
      let s="";
      for (let i=0;i<4;i++) s += ("0"+((n >>> (i*8)) & 0xff).toString(16)).slice(-2);
      return s;
    }
    return hex(a0)+hex(b0)+hex(c0)+hex(d0);
  }

  return { md5 };
});