// Province name mappings for address detection
export const PROVINCES = [
    '北京', '天津', '上海', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南',
    '陕西', '甘肃', '青海',
    '广西', '内蒙古', '西藏', '宁夏', '新疆',
    '香港', '澳门', '台湾',
];

export const PROVINCE_ALIASES: Record<string, string> = {
    '北京市': '北京', '天津市': '天津', '上海市': '上海', '重庆市': '重庆',
    '河北省': '河北', '山西省': '山西', '辽宁省': '辽宁', '吉林省': '吉林',
    '黑龙江省': '黑龙江', '江苏省': '江苏', '浙江省': '浙江', '安徽省': '安徽',
    '福建省': '福建', '江西省': '江西', '山东省': '山东', '河南省': '河南',
    '湖北省': '湖北', '湖南省': '湖南', '广东省': '广东', '海南省': '海南',
    '四川省': '四川', '贵州省': '贵州', '云南省': '云南', '陕西省': '陕西',
    '甘肃省': '甘肃', '青海省': '青海',
    '广西': '广西', '广西省': '广西', '广西壮族自治区': '广西',
    '内蒙古': '内蒙古', '内蒙古自治区': '内蒙古',
    '西藏': '西藏', '西藏自治区': '西藏',
    '宁夏': '宁夏', '宁夏回族自治区': '宁夏',
    '新疆': '新疆', '新疆维吾尔自治区': '新疆',
    '香港': '香港', '香港特别行政区': '香港',
    '澳门': '澳门', '澳门特别行政区': '澳门',
    '台湾': '台湾', '台湾省': '台湾',
};

export function detectProvince(address: string): string | null {
    if (!address) return null;
    // Try full names first (e.g. "广东省")
    for (const [alias, province] of Object.entries(PROVINCE_ALIASES)) {
        if (address.includes(alias)) return province;
    }
    // Try short names (e.g. "广东")
    for (const p of PROVINCES) {
        if (address.includes(p)) return p;
    }
    return null;
}
