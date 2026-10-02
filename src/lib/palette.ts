// 糖果色：彩度、明度相近，放在一起很和諧；前兩個（珊瑚紅、天空藍）差異最大，給第一關用
export const CANDY = [
  { name: '珊瑚紅', base: '#FF6F61', hi: '#FF9D8E', lo: '#E5493E' },
  { name: '天空藍', base: '#4A9BF6', hi: '#7EBBFF', lo: '#2C77D8' },
  { name: '向日葵黃', base: '#FFC43D', hi: '#FFDA7A', lo: '#EDA10E' },
  { name: '薄荷綠', base: '#2DC491', hi: '#64DDB2', lo: '#159E71' },
  { name: '薰衣草紫', base: '#A47CF3', hi: '#C4A8FF', lo: '#8257DB' },
] as const;
