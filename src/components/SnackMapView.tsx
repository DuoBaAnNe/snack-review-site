'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { MapChart } from 'echarts/charts';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { Snack } from '@/types';
import { detectProvince } from '@/lib/provinces';
import { getMapPanelPosition, type MapPanelPosition } from './snack-map-panel-position';
import { shouldClearMapHoverPanel } from './snack-map-hover';

echarts.use([MapChart, GeoComponent, TooltipComponent, CanvasRenderer]);

const SHORT_TO_FULL: Record<string, string> = {
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

let mapRegistered = false;

// Hand-tuned label anchor points (lng, lat) so province names sit centered
// on each province instead of echarts' auto position, which drifts on
// irregular shapes like 青海/甘肃/内蒙古.
const LABEL_CP: Record<string, [number, number]> = {
    '北京市': [116.46, 40.25],
    '天津市': [117.42, 39.42],
    '河北省': [115.00, 38.30],
    '山西省': [112.34, 37.94],
    '内蒙古自治区': [110.35, 41.49],
    '辽宁省': [122.60, 41.30],
    '吉林省': [126.19, 43.67],
    '黑龙江省': [127.97, 47.50],
    '上海市': [121.46, 31.29],
    '江苏省': [119.50, 32.90],
    '浙江省': [119.95, 29.20],
    '安徽省': [117.29, 32.06],
    '福建省': [117.98, 26.05],
    '江西省': [115.70, 27.60],
    '山东省': [118.00, 36.40],
    '河南省': [113.47, 33.88],
    '湖北省': [112.30, 31.00],
    '湖南省': [111.71, 27.63],
    '广东省': [113.40, 23.35],
    '广西壮族自治区': [108.48, 23.60],
    '海南省': [109.75, 19.30],
    '重庆市': [107.75, 30.10],
    '四川省': [102.70, 30.60],
    '贵州省': [106.61, 26.94],
    '云南省': [101.87, 25.18],
    '西藏自治区': [88.10, 31.30],
    '陕西省': [109.00, 35.60],
    '甘肃省': [100.90, 38.20],
    '青海省': [96.24, 35.60],
    '宁夏回族自治区': [106.00, 37.30],
    '新疆维吾尔自治区': [85.00, 41.50],
    '台湾省': [120.97, 23.75],
    '香港特别行政区': [114.26, 22.32],
    '澳门特别行政区': [113.55, 22.15],
};

function getIsDark(): boolean {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function SnackMapView({ snacks }: { snacks: Snack[] }) {
    const router = useRouter();
    const chartRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);
    const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [chartH, setChartH] = useState(540);
    const [isDark, setIsDark] = useState(false);

    // Size the chart so China's east-west extent spans the full content
    // width; height follows the map's natural aspect ratio.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const apply = () => setChartH(Math.max(380, Math.round(el.clientWidth * 0.72)));
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        apply();
        return () => ro.disconnect();
    }, []);

    // Re-fit the chart whenever its box height changes
    useEffect(() => {
        instanceRef.current?.resize();
    }, [chartH]);

    // Track theme changes (moon/sun toggle or system setting) so the chart
    // background always matches the card behind it — avoids jagged edges
    useEffect(() => {
        const update = () => setIsDark(getIsDark());
        update();
        const mo = new MutationObserver(update);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', update);
        return () => { mo.disconnect(); mq.removeEventListener('change', update); };
    }, []);

    // Custom floating panel state
    const [floatPanel, setFloatPanel] = useState<{
        province: string;
        snacks: Snack[];
        panelPosition: MapPanelPosition;
        pinned: boolean;
    } | null>(null);

    // Group snacks by province
    const provinceMap = useMemo(() => {
        const map = new Map<string, Snack[]>();
        for (const snack of snacks) {
            // Province follows the brand holder: its registered address first,
            // falling back to the company name itself (which usually embeds a
            // province, e.g. "福建达利...").
            const province =
                detectProvince(snack.manufacturer_address || '') ||
                detectProvince(snack.manufacturer_name || '');
            if (province) {
                if (!map.has(province)) map.set(province, []);
                map.get(province)!.push(snack);
            }
        }
        return map;
    }, [snacks]);

    const provincesWithSnacks = useMemo(() => new Set(provinceMap.keys()), [provinceMap]);

    // Register map — the geo data chunk can fail on flaky networks, so
    // failures show a retry button instead of a silently blank map
    const loadMap = useCallback(() => {
        if (mapRegistered) { setMapState('ready'); return; }
        setMapState('loading');
        import('echarts-china-map/lib/china.json').then((geo) => {
            const json = (geo.default || geo) as any;
            // Patch label anchor points before registering
            for (const f of json.features || []) {
                const cp = LABEL_CP[f.properties?.name];
                if (cp) f.properties.cp = cp;
            }
            echarts.registerMap('china', json);
            mapRegistered = true;
            setMapState('ready');
        }).catch(() => setMapState('error'));
    }, []);

    useEffect(() => { loadMap(); }, [loadMap]);

    const maxCount = useMemo(() =>
        Math.max(...Array.from(provincesWithSnacks).map((p) => provinceMap.get(p)?.length || 0), 1),
        [provincesWithSnacks, provinceMap]
    );

    // Color function: green gradient by snack count
    const getGreen = useCallback((count: number) => {
        if (count === 0) return '#e2e8f0';
        const ratio = Math.log(count + 1) / Math.log(maxCount + 1);
        const r = Math.round(200 - ratio * 180);
        const g = Math.round(230 - ratio * 100);
        const b = Math.round(200 - ratio * 170);
        return `rgb(${r},${g},${b})`;
    }, [maxCount]);

    useEffect(() => {
        if (mapState !== 'ready' || !chartRef.current) return;

        if (instanceRef.current) instanceRef.current.dispose();

        const chart = echarts.init(chartRef.current);
        instanceRef.current = chart;

        // Build data with full province names
        const mapData = Array.from(provincesWithSnacks).map((shortName) => {
            const fullName = SHORT_TO_FULL[shortName] || shortName;
            const count = provinceMap.get(shortName)?.length || 0;
            return {
                name: fullName,
                value: count,
                itemStyle: { areaColor: getGreen(count) },
                snacks: provinceMap.get(shortName) || [],
                shortName,
            };
        });

        // Also add provinces with NO snacks (grey)
        const allFullNames = Object.values(SHORT_TO_FULL);
        const mappedNames = new Set(mapData.map((d) => d.name));
        for (const fullName of allFullNames) {
            if (!mappedNames.has(fullName)) {
                mapData.push({
                    name: fullName,
                    value: 0,
                    itemStyle: { areaColor: '#e2e8f0' },
                    snacks: [],
                    shortName: '',
                });
            }
        }

        const option: EChartsCoreOption = {
            // Solid color matching the card behind it, per theme — a solid
            // background lets the canvas anti-alias the province edges
            backgroundColor: '#faf0e4',
            tooltip: { show: false }, // we handle tooltip ourselves
            series: [{
                type: 'map',
                map: 'china',
                roam: false,
                // Stretch the map so its east-west extent fills the container
                layoutCenter: ['50%', '50%'],
                layoutSize: '98%',
                label: { show: false }, // labels off by default
                emphasis: {
                    label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#333' },
                    itemStyle: { borderColor: '#fff', borderWidth: 2 },
                },
                itemStyle: {
                    borderColor: '#cbd5e1',
                    borderWidth: 0.8,
                    areaColor: '#e2e8f0',
                },
                data: mapData,
                select: {
                    label: { show: true, color: '#333' },
                    itemStyle: { borderColor: '#fff', borderWidth: 2.5 },
                },
                selectedMode: 'single',
            }],
        };

        chart.setOption(option);
        const container = containerRef.current;

        // ECharts series events fire only while the pointer is over a rendered region.
        chart.on('mousemove', (params: any) => {
            if (params.data?.snacks && params.data.snacks.length > 0) {
                const cx = params.event?.event?.clientX ?? 0;
                const cy = params.event?.event?.clientY ?? 0;
                if (!container) return;
                const panelPosition = getMapPanelPosition(cx, cy, container.getBoundingClientRect());
                setFloatPanel((prev) => {
                    if (prev?.pinned) return prev;
                    return {
                        province: params.data.shortName || params.name,
                        snacks: params.data.snacks,
                        panelPosition,
                        pinned: false,
                    };
                });
            } else {
                // A rendered province with no snacks clears an unpinned panel.
                setFloatPanel((prev) => prev?.pinned ? prev : null);
            }
        });

        // ZRender also reports movement over the canvas background. When it has
        // no target, the pointer is over ocean or another blank part of the map.
        const renderer = chart.getZr();
        const onRendererMouseMove = (event: { target?: unknown }) => {
            setFloatPanel((prev) => shouldClearMapHoverPanel({
                hasRenderTarget: Boolean(event.target),
                pinned: Boolean(prev?.pinned),
            }) ? null : prev);
        };
        renderer.on('mousemove', onRendererMouseMove);

        const onContainerLeave = () => setFloatPanel((prev) => prev?.pinned ? prev : null);
        container?.addEventListener('mouseleave', onContainerLeave);

        chart.on('click', (params: any) => {
            if (params.data?.snacks && params.data.snacks.length > 0) {
                const cx = params.event?.event?.clientX ?? 0;
                const cy = params.event?.event?.clientY ?? 0;
                if (!container) return;
                setFloatPanel({
                    province: params.data.shortName || params.name,
                    snacks: params.data.snacks,
                    panelPosition: getMapPanelPosition(cx, cy, container.getBoundingClientRect()),
                    pinned: true,
                });
            } else {
                setFloatPanel(null);
            }
        });

        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            container?.removeEventListener('mouseleave', onContainerLeave);
            renderer.off('mousemove', onRendererMouseMove);
            chart.dispose();
        };
    }, [mapState, provinceMap, provincesWithSnacks, maxCount, getGreen, isDark]);

    return (
        <div>
            <div ref={containerRef} className="relative isolate mx-auto w-full">
                {mapState === 'ready' ? (
                    <div ref={chartRef} style={{ width: '100%', height: chartH }} />
                ) : mapState === 'loading' ? (
                    <div className="h-[500px] animate-pulse bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400">地图资源加载中...</span>
                    </div>
                ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center gap-3">
                        <p className="text-sm text-gray-500">地图资源加载失败（可能是网络波动）</p>
                        <button
                            onClick={loadMap}
                            className="px-4 py-1.5 text-sm rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                        >
                            重试
                        </button>
                        <p className="text-xs text-gray-400">重试无效时请刷新页面</p>
                    </div>
                )}

                {/* Custom floating panel — anchored to the clicked point inside the map */}
                {floatPanel && floatPanel.snacks.length > 0 && (
                    <div
                        className="z-30 w-[146px] bg-white rounded-lg shadow-xl border border-gray-200 p-3"
                        style={{
                            ...floatPanel.panelPosition,
                            pointerEvents: floatPanel.pinned ? 'auto' : 'none',
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-700">
                                {floatPanel.province}（{floatPanel.snacks.length}款）
                            </span>
                            {floatPanel.pinned && (
                                <button
                                    onClick={() => setFloatPanel(null)}
                                    className="text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                            {floatPanel.snacks.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => router.push(`/snacks/${s.id}`)}
                                    className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 hover:border-green-400 hover:shadow-md transition-all cursor-pointer flex-shrink-0"
                                    title={s.product_name}
                                >
                                    {s.images[0] ? (
                                        <img src={`/api/images/${s.images[0].id}`} alt={s.product_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xl">🍿</div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                            {floatPanel.pinned ? (
                                <>
                                    <span className="block">点击缩略图进入详情</span>
                                    <span className="block">点击✕关闭</span>
                                </>
                            ) : '点击省份固定面板'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
