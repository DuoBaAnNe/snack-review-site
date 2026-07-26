// The 34 provincial factions: canonical order, echarts full names, and a
// stable distinct colour per faction (used to paint owned territory).

export const PROVINCES = [
    '北京', '天津', '上海', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海',
    '广西', '内蒙古', '西藏', '宁夏', '新疆',
    '香港', '澳门', '台湾',
] as const;

export type Province = typeof PROVINCES[number];

// short name -> echarts-china-map full region name
export const SHORT_TO_FULL: Record<string, string> = {
    '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
    '河北': '河北省', '山西': '山西省', '辽宁': '辽宁省', '吉林': '吉林省',
    '黑龙江': '黑龙江省', '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省',
    '福建': '福建省', '江西': '江西省', '山东': '山东省', '河南': '河南省',
    '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省', '海南': '海南省',
    '四川': '四川省', '贵州': '贵州省', '云南': '云南省', '陕西': '陕西省',
    '甘肃': '甘肃省', '青海': '青海省',
    '广西': '广西壮族自治区', '内蒙古': '内蒙古自治区',
    '西藏': '西藏自治区', '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
    '香港': '香港特别行政区', '澳门': '澳门特别行政区', '台湾': '台湾省',
};

export const FULL_TO_SHORT: Record<string, string> = Object.fromEntries(
    Object.entries(SHORT_TO_FULL).map(([s, f]) => [f, s])
);

// Distinct hue per faction, evenly spread around the wheel so any two
// surviving factions read as different colours on the map.
export const FACTION_COLOR: Record<string, string> = Object.fromEntries(
    PROVINCES.map((p, i) => [p, `hsl(${Math.round((i * 360) / PROVINCES.length)}, 68%, 55%)`])
);
