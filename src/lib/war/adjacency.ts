// Land borders between the 34 provincial factions, plus a few "across the
// strait/bay" links so island provinces can still fight (海南↔广东,
// 台湾↔福建, 香港/澳门↔广东). Defined as an undirected edge list; the
// symmetric adjacency map is built from it.
import { PROVINCES } from './provinces-meta';

const EDGES: [string, string][] = [
    ['北京', '河北'], ['北京', '天津'], ['天津', '河北'],
    ['河北', '辽宁'], ['河北', '内蒙古'], ['河北', '山西'], ['河北', '河南'], ['河北', '山东'],
    ['山西', '内蒙古'], ['山西', '陕西'], ['山西', '河南'],
    ['内蒙古', '黑龙江'], ['内蒙古', '吉林'], ['内蒙古', '辽宁'], ['内蒙古', '陕西'],
    ['内蒙古', '宁夏'], ['内蒙古', '甘肃'],
    ['辽宁', '吉林'], ['吉林', '黑龙江'],
    ['上海', '江苏'], ['上海', '浙江'],
    ['江苏', '山东'], ['江苏', '安徽'], ['江苏', '浙江'],
    ['浙江', '安徽'], ['浙江', '江西'], ['浙江', '福建'],
    ['安徽', '山东'], ['安徽', '河南'], ['安徽', '湖北'], ['安徽', '江西'],
    ['福建', '江西'], ['福建', '广东'], ['福建', '台湾'],
    ['江西', '湖北'], ['江西', '湖南'], ['江西', '广东'],
    ['山东', '河南'],
    ['河南', '陕西'], ['河南', '湖北'],
    ['湖北', '陕西'], ['湖北', '重庆'], ['湖北', '湖南'],
    ['湖南', '重庆'], ['湖南', '贵州'], ['湖南', '广西'], ['湖南', '广东'],
    ['广东', '广西'], ['广东', '海南'], ['广东', '香港'], ['广东', '澳门'],
    ['四川', '青海'], ['四川', '甘肃'], ['四川', '陕西'], ['四川', '重庆'],
    ['四川', '贵州'], ['四川', '云南'], ['四川', '西藏'],
    ['贵州', '重庆'], ['贵州', '广西'], ['贵州', '云南'],
    ['云南', '西藏'], ['云南', '广西'],
    ['陕西', '甘肃'], ['陕西', '宁夏'], ['陕西', '重庆'],
    ['甘肃', '宁夏'], ['甘肃', '青海'], ['甘肃', '新疆'],
    ['青海', '西藏'], ['青海', '新疆'],
    ['西藏', '新疆'],
];

export const ADJACENCY: Record<string, string[]> = (() => {
    const map: Record<string, string[]> = {};
    for (const p of PROVINCES) map[p] = [];
    for (const [a, b] of EDGES) {
        if (!map[a].includes(b)) map[a].push(b);
        if (!map[b].includes(a)) map[b].push(a);
    }
    return map;
})();

export function neighborsOf(province: string): string[] {
    return ADJACENCY[province] || [];
}
