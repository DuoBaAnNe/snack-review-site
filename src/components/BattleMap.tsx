'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { MapChart } from 'echarts/charts';
import { GeoComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { Snack } from '@/types';
import { detectProvince } from '@/lib/provinces';
import { getImageUrl } from '@/lib/image-url';
import { SHORT_TO_FULL, FULL_TO_SHORT } from '@/lib/war/provinces-meta';

echarts.use([MapChart, GeoComponent, TooltipComponent, CanvasRenderer]);

interface Territory { province: string; owner: string; garrison: number; color: string }
interface Leader { faction: string; territories: number; power: number; color: string }
interface Payload {
    season: { id: number; endsAt: string };
    territories: Territory[];
    leaderboard: Leader[];
    log: { at: string; message: string }[];
    lastWinner: string | null;
}

let mapRegistered = false;

function countdown(endsAt: string): string {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return '即将结算';
    const d = Math.floor(ms / 86400_000);
    const h = Math.floor((ms % 86400_000) / 3600_000);
    const m = Math.floor((ms % 3600_000) / 60_000);
    if (d > 0) return `${d}天${h}小时`;
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分`;
}

export default function BattleMap({ snacks }: { snacks: Snack[] }) {
    const chartRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);
    const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [payload, setPayload] = useState<Payload | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [liking, setLiking] = useState<number | null>(null);
    const [chartH, setChartH] = useState(560);

    // Group snacks by province once (for the click-to-like panel)
    const snacksByProvince = useMemo(() => {
        const m = new Map<string, Snack[]>();
        for (const s of snacks) {
            const p = detectProvince(s.manufacturer_address || '') || detectProvince(s.manufacturer_name || '');
            if (!p) continue;
            if (!m.has(p)) m.set(p, []);
            m.get(p)!.push(s);
        }
        return m;
    }, [snacks]);

    const territoryByProvince = useMemo(() => {
        const m = new Map<string, Territory>();
        for (const t of payload?.territories || []) m.set(t.province, t);
        return m;
    }, [payload]);

    // Register the china geo json once
    const loadMap = useCallback(() => {
        if (mapRegistered) { setMapState('ready'); return; }
        setMapState('loading');
        import('echarts-china-map/lib/china.json').then((geo) => {
            echarts.registerMap('china', (geo.default || geo) as any);
            mapRegistered = true;
            setMapState('ready');
        }).catch(() => setMapState('error'));
    }, []);
    useEffect(() => { loadMap(); }, [loadMap]);

    // Fetch + poll war state
    const fetchState = useCallback(async () => {
        try {
            const res = await fetch('/api/battle/state', { cache: 'no-store' });
            if (res.ok) setPayload(await res.json());
        } catch { /* transient; next poll retries */ }
    }, []);
    useEffect(() => {
        fetchState();
        const t = setInterval(fetchState, 4000);
        return () => clearInterval(t);
    }, [fetchState]);

    // Size the chart to the container
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const apply = () => setChartH(Math.max(400, Math.round(el.clientWidth * 0.72)));
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        apply();
        return () => ro.disconnect();
    }, []);
    useEffect(() => { instanceRef.current?.resize(); }, [chartH]);

    // Render / update the map
    useEffect(() => {
        if (mapState !== 'ready' || !chartRef.current || !payload) return;
        if (!instanceRef.current) instanceRef.current = echarts.init(chartRef.current);
        const chart = instanceRef.current;

        const data = payload.territories.map((t) => ({
            name: SHORT_TO_FULL[t.province] || t.province,
            value: t.garrison,
            shortName: t.province,
            itemStyle: { areaColor: t.color },
        }));

        const option: EChartsCoreOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: (p: any) => {
                    const sn = p.data?.shortName;
                    const terr = sn ? territoryByProvince.get(sn) : null;
                    if (!terr) return p.name;
                    return `${p.name}<br/>归属：${terr.owner}<br/>驻军：${terr.garrison}`;
                },
            },
            series: [{
                type: 'map', map: 'china', roam: false,
                layoutCenter: ['50%', '50%'], layoutSize: '98%',
                label: { show: false },
                emphasis: { label: { show: true, fontSize: 12, color: '#111' }, itemStyle: { borderColor: '#fff', borderWidth: 2 } },
                itemStyle: { borderColor: 'rgba(255,255,255,0.6)', borderWidth: 0.8 },
                select: { itemStyle: { borderColor: '#111', borderWidth: 2 } },
                selectedMode: 'single',
                data,
            }],
        };
        chart.setOption(option);

        const onClick = (p: any) => {
            const sn = p.data?.shortName || FULL_TO_SHORT[p.name];
            if (sn) setSelected(sn);
        };
        chart.off('click');
        chart.on('click', onClick);
    }, [mapState, payload, territoryByProvince]);

    const likeSnack = async (id: number) => {
        setLiking(id);
        try {
            await fetch(`/api/snacks/${id}/like`, { method: 'POST' });
            await fetchState(); // reflect the war advancing
        } catch { /* ignore */ }
        setLiking(null);
    };

    const selectedTerr = selected ? territoryByProvince.get(selected) : null;
    const selectedSnacks = selected ? (snacksByProvince.get(selected) || []) : [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Map */}
            <div className="lg:col-span-2">
                <div ref={containerRef} className="relative w-full rounded-xl bg-white/60 border border-gray-100 overflow-hidden">
                    {mapState === 'ready' ? (
                        <div ref={chartRef} style={{ width: '100%', height: chartH }} />
                    ) : mapState === 'loading' ? (
                        <div className="flex items-center justify-center text-gray-400" style={{ height: chartH }}>地图加载中…</div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400" style={{ height: chartH }}>
                            <p>地图加载失败</p>
                            <button onClick={loadMap} className="px-3 py-1 text-sm rounded border border-gray-300">重试</button>
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">点击地图上的省份，给它的零食点赞助攻 · 每次点赞都会推进战线</p>
            </div>

            {/* Side panel */}
            <div className="space-y-4">
                {/* Season */}
                <div className="rounded-xl bg-white border border-gray-100 p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">第 {payload?.season.id ?? '—'} 赛季</span>
                        <span className="text-sm text-orange-500">{payload ? countdown(payload.season.endsAt) : '…'}</span>
                    </div>
                    {payload?.lastWinner && (
                        <p className="text-xs text-gray-400 mt-1">上季冠军：<span className="text-amber-600 font-medium">{payload.lastWinner}</span></p>
                    )}
                </div>

                {/* Selected province */}
                {selected && (
                    <div className="rounded-xl bg-white border border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-800">{selected}</span>
                            <button onClick={() => setSelected(null)} className="text-gray-400 text-sm">✕</button>
                        </div>
                        {selectedTerr && (
                            <p className="text-xs text-gray-500 mb-2">
                                当前归属 <span className="font-medium" style={{ color: selectedTerr.color }}>{selectedTerr.owner}</span> · 驻军 {selectedTerr.garrison}
                            </p>
                        )}
                        {selectedSnacks.length > 0 ? (
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {selectedSnacks.map((s) => (
                                    <div key={s.id} className="flex items-center gap-2">
                                        {s.images[0]
                                            ? <img src={getImageUrl(s.images[0])} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                                            : <div className="w-9 h-9 rounded bg-gray-100 shrink-0" />}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-gray-800 truncate">{s.brand_name} {s.product_name}</p>
                                        </div>
                                        <button
                                            onClick={() => likeSnack(s.id)}
                                            disabled={liking === s.id}
                                            className="text-xs px-2 py-1 rounded-md bg-orange-500 text-white hover:opacity-90 disabled:opacity-50 shrink-0"
                                        >
                                            {liking === s.id ? '…' : '👍 助攻'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400">这个省还没有零食，无法助攻。</p>
                        )}
                    </div>
                )}

                {/* Leaderboard */}
                <div className="rounded-xl bg-white border border-gray-100 p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">势力排行</h3>
                    <div className="space-y-1">
                        {(payload?.leaderboard || []).slice(0, 8).map((l) => (
                            <div key={l.faction} className="flex items-center gap-2 text-sm">
                                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: l.color }} />
                                <span className="flex-1 text-gray-700 truncate">{l.faction}</span>
                                <span className="text-gray-500">{l.territories} 省</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* War log */}
                <div className="rounded-xl bg-white border border-gray-100 p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">战报</h3>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                        {(payload?.log || []).length === 0
                            ? <p className="text-xs text-gray-400">还没有战斗，点赞助攻开战吧！</p>
                            : payload!.log.map((e, i) => (
                                <p key={i} className="text-xs text-gray-600">⚔️ {e.message}</p>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
