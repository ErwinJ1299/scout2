'use client';

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

interface DataPoint {
  date: string;
  value: number;
  value2?: number; // For diastolic or secondary value
}

interface HealthChartProps {
  type: 'line' | 'bar';
  title: string;
  subtitle?: string;
  dataset: DataPoint[];
  color?: { start: string; end: string };
  color2?: { start: string; end: string }; // For second line in twoLineMode
  twoLineMode?: boolean;
  unit?: string;
}

export function HealthChart({
  type,
  title,
  subtitle,
  dataset,
  color,
  color2,
  twoLineMode = false,
  unit = '',
}: HealthChartProps) {
  const option = useMemo(() => {
    const dates = dataset.map((d) => d.date);
    const values = dataset.map((d) => d.value);
    const values2 = twoLineMode ? dataset.map((d) => d.value2) : [];

    // Default colors if not provided
    const primaryColor = color || { start: '#4285f4', end: '#7baaf7' };
    const secondaryColor = color2 || { start: '#ffa726', end: '#ff9800' };

    const getGradient = (c: { start: string; end: string }) => {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: c.start },
        { offset: 1, color: c.end },
      ]);
    };

    const getAreaGradient = (c: { start: string; end: string }) => {
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: c.start },
        { offset: 1, color: 'rgba(255, 255, 255, 0.1)' },
      ]);
    };

    const seriesList = [];

    // Primary Series
    seriesList.push({
      name: twoLineMode ? 'Systolic' : title,
      type: type,
      data: values,
      smooth: true,
      showSymbol: false,
      symbolSize: 8,
      lineStyle: {
        width: 4,
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowBlur: 10,
        shadowOffsetY: 5,
      },
      areaStyle: type === 'line' ? {
        opacity: 0.3,
        color: getAreaGradient(primaryColor),
      } : undefined,
      emphasis: {
        focus: 'series',
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.3)',
        },
      },
      barMaxWidth: 40,
      itemStyle: type === 'bar' ? {
        color: getGradient(primaryColor),
        borderRadius: [4, 4, 0, 0],
      } : {
        color: getGradient(primaryColor),
        shadowColor: primaryColor.start,
        shadowBlur: 10,
      },
    });

    // Secondary Series (for BP)
    if (twoLineMode) {
      seriesList.push({
        name: 'Diastolic',
        type: 'line',
        data: values2,
        smooth: true,
        showSymbol: false,
        symbolSize: 8,
        itemStyle: {
          color: getGradient(secondaryColor),
          shadowColor: secondaryColor.start,
          shadowBlur: 10,
        },
        lineStyle: {
          width: 4,
          shadowColor: 'rgba(0,0,0,0.1)',
          shadowBlur: 10,
          shadowOffsetY: 5,
        },
        areaStyle: {
          opacity: 0.3,
          color: getAreaGradient(secondaryColor),
        },
        emphasis: {
          focus: 'series',
        },
      });
    }

    return {
      grid: {
        top: 40,
        right: 20,
        bottom: 20,
        left: 40,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#eee',
        borderWidth: 1,
        textStyle: {
          color: '#333',
        },
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
          lineStyle: {
            color: '#aaa',
            type: 'dashed',
          },
        },
        formatter: (params: any) => {
          let result = `<div class="font-bold mb-1">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            const val = param.value;
            const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color.colorStops ? param.color.colorStops[0].color : param.color};"></span>`;
            result += `<div>${marker} ${param.seriesName}: <strong>${val} ${unit}</strong></div>`;
          });
          return result;
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: type === 'bar', // True for bar, false for line usually, but let's keep it simple
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#9ca3af',
          formatter: (value: string) => {
            // Shorten date if needed, e.g., "Mon 12"
            return value;
          },
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#f3f4f6',
          },
        },
        axisLabel: {
          color: '#9ca3af',
        },
      },
      legend: {
        show: true,
        top: 0,
        right: 0,
        icon: 'circle',
        textStyle: {
          color: '#6b7280',
        },
      },
      series: seriesList,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
    };
  }, [type, title, dataset, color, color2, twoLineMode, unit]);

  return (
    <div className="w-full h-[350px] bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <ReactECharts
        option={option}
        style={{ height: '280px', width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
