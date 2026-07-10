'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Snack } from '@/types';

// Country name mapping: GeoJSON English → Chinese
const CN_MAP: Record<string, string> = {
    'China': '中国', 'Hong Kong': '香港', 'Macau': '澳门', 'Mongolia': '蒙古',
    'Japan': '日本', 'South Korea': '韩国', 'North Korea': '朝鲜',
    'United States': '美国', 'Canada': '加拿大', 'Mexico': '墨西哥', 'Cuba': '古巴',
    'Brazil': '巴西', 'Argentina': '阿根廷', 'Chile': '智利', 'Peru': '秘鲁', 'Colombia': '哥伦比亚',
    'Venezuela': '委内瑞拉', 'Bolivia': '玻利维亚', 'Ecuador': '厄瓜多尔', 'Guyana': '圭亚那',
    'Suriname': '苏里南', 'Paraguay': '巴拉圭', 'Uruguay': '乌拉圭', 'Panama': '巴拿马',
    'Costa Rica': '哥斯达黎加', 'Nicaragua': '尼加拉瓜', 'Honduras': '洪都拉斯',
    'El Salvador': '萨尔瓦多', 'Guatemala': '危地马拉', 'Belize': '伯利兹', 'Jamaica': '牙买加',
    'Haiti': '海地', 'Dominican Republic': '多米尼加', 'Puerto Rico': '波多黎各',
    'United Kingdom': '英国', 'Ireland': '爱尔兰', 'France': '法国', 'Germany': '德国',
    'Italy': '意大利', 'Spain': '西班牙', 'Portugal': '葡萄牙', 'Netherlands': '荷兰',
    'Belgium': '比利时', 'Switzerland': '瑞士', 'Austria': '奥地利', 'Sweden': '瑞典',
    'Norway': '挪威', 'Finland': '芬兰', 'Denmark': '丹麦', 'Iceland': '冰岛',
    'Poland': '波兰', 'Ukraine': '乌克兰', 'Czech Republic': '捷克', 'Slovakia': '斯洛伐克',
    'Hungary': '匈牙利', 'Romania': '罗马尼亚', 'Bulgaria': '保加利亚', 'Serbia': '塞尔维亚',
    'Croatia': '克罗地亚', 'Slovenia': '斯洛文尼亚', 'Bosnia and Herzegovina': '波黑',
    'Albania': '阿尔巴尼亚', 'Greece': '希腊', 'Estonia': '爱沙尼亚', 'Latvia': '拉脱维亚',
    'Lithuania': '立陶宛', 'Belarus': '白俄罗斯', 'Moldova': '摩尔多瓦',
    'Russia': '俄罗斯', 'Turkey': '土耳其', 'Cyprus': '塞浦路斯', 'Georgia': '格鲁吉亚',
    'Armenia': '亚美尼亚', 'Azerbaijan': '阿塞拜疆', 'Iran': '伊朗', 'Iraq': '伊拉克',
    'Syria': '叙利亚', 'Lebanon': '黎巴嫩', 'Jordan': '约旦', 'Israel': '以色列',
    'Saudi Arabia': '沙特阿拉伯', 'United Arab Emirates': '阿联酋', 'Yemen': '也门',
    'Oman': '阿曼', 'Kuwait': '科威特', 'Qatar': '卡塔尔', 'Bahrain': '巴林',
    'Afghanistan': '阿富汗', 'Pakistan': '巴基斯坦', 'India': '印度',
    'Bangladesh': '孟加拉国', 'Nepal': '尼泊尔', 'Bhutan': '不丹', 'Sri Lanka': '斯里兰卡',
    'Myanmar': '缅甸', 'Thailand': '泰国', 'Vietnam': '越南', 'Laos': '老挝',
    'Cambodia': '柬埔寨', 'Malaysia': '马来西亚', 'Indonesia': '印度尼西亚',
    'Philippines': '菲律宾', 'Singapore': '新加坡', 'Brunei': '文莱', 'East Timor': '东帝汶',
    'Australia': '澳大利亚', 'New Zealand': '新西兰', 'Papua New Guinea': '巴布亚新几内亚',
    'Fiji': '斐济', 'Kazakhstan': '哈萨克斯坦', 'Uzbekistan': '乌兹别克斯坦',
    'Turkmenistan': '土库曼斯坦', 'Kyrgyzstan': '吉尔吉斯斯坦', 'Tajikistan': '塔吉克斯坦',
    'Egypt': '埃及', 'Libya': '利比亚', 'Algeria': '阿尔及利亚', 'Morocco': '摩洛哥',
    'Tunisia': '突尼斯', 'Sudan': '苏丹', 'South Sudan': '南苏丹', 'Ethiopia': '埃塞俄比亚',
    'Somalia': '索马里', 'Kenya': '肯尼亚', 'Tanzania': '坦桑尼亚', 'Uganda': '乌干达',
    'Rwanda': '卢旺达', 'Burundi': '布隆迪', 'Madagascar': '马达加斯加',
    'South Africa': '南非', 'Zimbabwe': '津巴布韦', 'Zambia': '赞比亚', 'Mozambique': '莫桑比克',
    'Angola': '安哥拉', 'Namibia': '纳米比亚', 'Botswana': '博茨瓦纳',
    'Nigeria': '尼日利亚', 'Ghana': '加纳', 'Senegal': '塞内加尔', 'Mali': '马里',
    'Niger': '尼日尔', 'Chad': '乍得', 'Cameroon': '喀麦隆', 'Gabon': '加蓬',
    'Democratic Republic of the Congo': '刚果（金）', 'Republic of the Congo': '刚果（布）',
    'Central African Republic': '中非', 'Ivory Coast': '科特迪瓦', "Côte d'Ivoire": '科特迪瓦',
    'Burkina Faso': '布基纳法索', 'Guinea': '几内亚', 'Sierra Leone': '塞拉利昂',
    'Liberia': '利比里亚', 'Mauritania': '毛里塔尼亚', 'Benin': '贝宁', 'Togo': '多哥',
    'Gambia': '冈比亚', 'Guinea-Bissau': '几内亚比绍', 'Equatorial Guinea': '赤道几内亚',
    'Djibouti': '吉布提', 'Eritrea': '厄立特里亚', 'Malawi': '马拉维',
    'Mauritius': '毛里求斯', 'Eswatini': '斯威士兰', 'Lesotho': '莱索托',
    'Antarctica': '南极洲', 'Greenland': '格陵兰',
    'United States Minor Outlying Islands': '',
    'French Southern and Antarctic Lands': '',
    'Falkland Islands': '福克兰群岛', 'Bermuda': '百慕大',
    'Western Sahara': '西撒哈拉', 'Somaliland': '索马里兰',
    'Northern Cyprus': '北塞浦路斯', 'Kosovo': '科索沃',
};

// Translate all feature names in the GeoJSON
function translateGeoJSON(geo: any) {
    if (!geo?.features) return geo;
    const features: any[] = [];
    let chinaFeature: any = null;
    let taiwanFeature: any = null;

    for (const f of geo.features) {
        const en = f.properties?.name || '';
        if (en === 'China') { chinaFeature = f; continue; }
        if (en === 'Taiwan') { taiwanFeature = f; continue; }
        const cn = CN_MAP[en];
        const name = cn === '' ? en : (cn || en);
        features.push({ ...f, properties: { ...f.properties, name } });
    }

    // Merge Taiwan into China
    if (chinaFeature) {
        const mergedGeom = taiwanFeature
            ? {
                type: 'MultiPolygon',
                coordinates: [
                    ...(chinaFeature.geometry.type === 'MultiPolygon'
                        ? chinaFeature.geometry.coordinates
                        : [chinaFeature.geometry.coordinates]),
                    ...(taiwanFeature.geometry.type === 'MultiPolygon'
                        ? taiwanFeature.geometry.coordinates
                        : [taiwanFeature.geometry.coordinates]),
                ],
            }
            : chinaFeature.geometry;
        features.push({
            ...chinaFeature,
            geometry: mergedGeom,
            properties: { ...chinaFeature.properties, name: '中国' },
        });
    }

    return { ...geo, features };
}

// Country detection
function detectCountry(address: string): string {
    if (!address) return '';
    const list: [string, string[]][] = [
        ['中国', ['中国', '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '广西', '内蒙古', '西藏', '宁夏', '新疆', '香港', '澳门', '台湾']],
        ['日本', ['日本', '东京', '大阪']],
        ['韩国', ['韩国', '首尔', '首爾']],
        ['美国', ['美国', '美國', 'USA']],
        ['泰国', ['泰国', '泰國', '曼谷']],
        ['越南', ['越南', '河内']],
        ['马来西亚', ['马来西亚', '馬來西亞', '吉隆坡']],
        ['印度尼西亚', ['印度尼西亚', '印尼', '雅加达']],
        ['菲律宾', ['菲律宾', '菲律賓', '马尼拉']],
        ['印度', ['印度', '新德里']],
        ['英国', ['英国', '英國', '伦敦', '倫敦']],
        ['法国', ['法国', '法國', '巴黎']],
        ['德国', ['德国', '德國', '柏林']],
        ['意大利', ['意大利', '罗马', '羅馬']],
        ['西班牙', ['西班牙', '马德里']],
        ['澳大利亚', ['澳大利亚', '澳洲', '悉尼', '墨尔本']],
        ['新西兰', ['新西兰', '新西蘭', '奥克兰']],
        ['加拿大', ['加拿大', '多伦多', '温哥华']],
        ['巴西', ['巴西', '圣保罗']],
        ['新加坡', ['新加坡']],
        ['俄罗斯', ['俄罗斯', '俄羅斯', '莫斯科']],
    ];
    for (const [cn, kws] of list) for (const kw of kws) if (address.includes(kw)) return cn;
    return '';
}

let worldGeoRegistered = false;

export default function GlobeMapView({ snacks, onDrillChina }: { snacks: Snack[]; onDrillChina: () => void }) {
    const router = useRouter();
    const chartRef = useRef<HTMLDivElement>(null);
    const [selectedCountry, setSelectedCountry] = useState<{ name: string; snacks: Snack[] } | null>(null);
    const countryMap = useMemo(() => {
        const map = new Map<string, Snack[]>();
        for (const snack of snacks) {
            const country = detectCountry(snack.manufacturer_address || '');
            if (country) {
                if (!map.has(country)) map.set(country, []);
                map.get(country)!.push(snack);
            }
        }
        return map;
    }, [snacks]);

    const maxCount = useMemo(() => Math.max(...Array.from(countryMap.values()).map(s => s.length), 1), [countryMap]);

    useEffect(() => {
        if (!chartRef.current) return;
        let cancelled = false;
        let chart: any = null;

        (async () => {
            const echartsMod = await import('echarts');
            const echarts: any = (echartsMod as any).default || echartsMod;
            if (cancelled) return;

            if (chartRef.current && echarts.getInstanceByDom(chartRef.current)) {
                echarts.getInstanceByDom(chartRef.current)?.dispose();
            }

            if (!worldGeoRegistered) {
                try {
                    const res = await fetch('/world-countries.json');
                    const geo = await res.json();
                    const translated = translateGeoJSON(geo);
                    echarts.registerMap('world', translated);
                    worldGeoRegistered = true;
                } catch { if (cancelled) return; }
            }

            chart = echarts.init(chartRef.current);

            const mapData: any[] = [];
            for (const [cn, snackList] of countryMap.entries()) {
                const ratio = Math.log(snackList.length + 1) / Math.log(maxCount + 1);
                const g = Math.round(170 + ratio * 85);
                mapData.push({
                    name: cn,
                    value: snackList.length,
                    snacks: snackList,
                    itemStyle: {
                        areaColor: `rgb(${Math.round(190 - ratio * 175)},${g},${Math.round(190 - ratio * 155)})`,
                    },
                });
            }

            const option: any = {
                backgroundColor: '#1a1a2e',
                tooltip: {
                    trigger: 'item',
                    formatter: (p: any) => {
                        if (!p.data?.value) return p.name;
                        return `<b>${p.name}</b><br/>${p.data.value} 款零食`;
                    },
                },
                series: [{
                    type: 'map',
                    map: 'world',
                    roam: true,
                    scaleLimit: { min: 1, max: 8 },
                    label: { show: true, fontSize: 8, color: '#8899aa' },
                    emphasis: {
                        label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
                        itemStyle: { areaColor: '#f97316' },
                    },
                    itemStyle: {
                        borderColor: '#334455',
                        borderWidth: 0.5,
                        areaColor: '#1e293b',
                    },
                    data: mapData,
                }],
            };

            chart.setOption(option);

            chart.on('click', (params: any) => {
                if (params.name === '中国' || params.name === 'China') {
                    onDrillChina();
                } else if (params.data?.snacks?.length > 0) {
                    setSelectedCountry({ name: params.name, snacks: params.data.snacks });
                }
            });

            const h = () => chart.resize();
            window.addEventListener('resize', h);
            return () => { window.removeEventListener('resize', h); };
        })();

        return () => { cancelled = true; chart?.dispose(); };
    }, [countryMap, maxCount, onDrillChina]);

    return (
        <div className="bg-[#1a1a2e] rounded-xl shadow-md border border-gray-700 p-4">
            <h2 className="text-lg font-bold text-white mb-2 text-center">🗺️ 零食世界地图</h2>
            <div ref={chartRef} style={{ width: '100%', height: 520 }} />

            {selectedCountry && (
                <div className="mt-3 p-3 bg-gray-800 border border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">
                            {selectedCountry.name}（{selectedCountry.snacks.length}款）
                        </span>
                        <button onClick={() => setSelectedCountry(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedCountry.snacks.map(s => (
                            <button key={s.id} onClick={() => router.push(`/snacks/${s.id}`)}
                                className="w-14 h-14 rounded-lg overflow-hidden border border-gray-600 hover:border-green-400 transition-all flex-shrink-0"
                                title={s.product_name}>
                                {s.images[0] ? (
                                    <img src={`/api/images/${s.images[0].id}`} alt={s.product_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xl">🍿</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-2 text-center text-xs text-gray-500">
                <span>共 {countryMap.size} 个国家有零食</span>
                <span className="mx-2">·</span>
                <span>总计 {snacks.length} 款零食</span>
                <span className="mx-2">·</span>
                <span>拖拽移动 · 滚轮缩放 · 点击中国查看省份</span>
            </div>
        </div>
    );
}
