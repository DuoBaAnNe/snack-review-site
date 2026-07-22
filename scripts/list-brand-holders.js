// List every live snack's brand-holder fields and the province the map
// currently derives from them, so the admin can spot which ones need fixing.
// Usage: node scripts/list-brand-holders.js
const fs = require('fs');
const path = require('path');

// --- province detection: same rules as src/lib/provinces.ts ---
const PROVINCES = [
    '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
    '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海',
    '广西', '内蒙古', '西藏', '宁夏', '新疆', '香港', '澳门', '台湾',
];
const ALIASES = {
    '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
    '河北省': '河北', '山西省': '山西', '辽宁省': '辽宁', '吉林省': '吉林',
    '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江', '安徽省': '安徽',
    '福建省': '福建', '江西省': '江西', '山东省': '山东', '河南省': '河南',
    '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东', '海南省': '海南',
    '四川省': '四川', '贵州省': '贵州', '云南省': '云南', '陕西省': '陕西',
    '甘肃省': '甘肃', '青海省': '青海', '广西壮族自治区': '广西',
    '内蒙古自治区': '内蒙古', '西藏自治区': '西藏', '宁夏回族自治区': '宁夏',
    '新疆维吾尔自治区': '新疆', '香港特别行政区': '香港',
    '澳门特别行政区': '澳门', '台湾省': '台湾',
};
function detectProvince(s) {
    if (!s) return null;
    for (const [alias, p] of Object.entries(ALIASES)) if (s.includes(alias)) return p;
    for (const p of PROVINCES) if (s.includes(p)) return p;
    return null;
}

function readEnv() {
    const env = {};
    const file = path.join(__dirname, '..', '.env.local');
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*#?\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    return env;
}

async function main() {
    const env = readEnv();
    const { createClient } = require('@libsql/client');
    const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

    const rows = (await db.execute(
        'SELECT id, brand_name, product_name, manufacturer_name, manufacturer_address FROM snacks ORDER BY id'
    )).rows;

    console.log(`\n共 ${rows.length} 个零食：\n`);
    for (const r of rows) {
        const holder = r.manufacturer_name || '(空)';
        const loc = r.manufacturer_address || '(空)';
        const prov = detectProvince(r.manufacturer_address || '') || detectProvince(r.manufacturer_name || '');
        console.log(`#${r.id}  ${r.brand_name} - ${r.product_name}`);
        console.log(`     品牌持有方: ${holder}`);
        console.log(`     所在地:     ${loc}`);
        console.log(`     地图判定:   ${prov ? prov : '⚠ 无法判定省份（地图上不显示）'}\n`);
    }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
