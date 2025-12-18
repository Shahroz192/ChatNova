import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ChartProps {
  type: 'bar' | 'line' | 'pie';
  data: { name?: string; label?: string; value: number }[];
  label: string;
}

const ChartRenderer: React.FC<ChartProps> = ({ type, data, label }) => {
  // Emphasize hierarchy: sort by value so the most important category is first (at the "top" of the circle for pie charts)
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  const labels = sortedData.map(item => item.name || item.label || '');
  const values = sortedData.map(item => item.value);

  const isPie = type === 'pie';

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: label || 'Data',
        data: values,
        // For pie charts, make the primary category bold and others progressively softer
        backgroundColor: isPie
          ? [
              '#4F46E5',          // primary (top of circle)
              'rgba(79, 70, 229, 0.65)',
              'rgba(79, 70, 229, 0.45)',
              'rgba(79, 70, 229, 0.30)',
              'rgba(148, 163, 184, 0.45)', // slate accents
              'rgba(148, 163, 184, 0.25)',
            ]
          : 'rgba(79, 70, 229, 0.5)',
        borderColor: isPie
          ? [
              '#312E81',
              '#3730A3',
              '#4338CA',
              '#4F46E5',
              '#64748B',
              '#94A3B8',
            ]
          : 'rgba(79, 70, 229, 1)',
        borderWidth: isPie ? 2 : 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        // Put legend on the right for clearer hierarchy, especially for pie charts
        position: isPie ? ('right' as const) : ('top' as const),
        labels: {
          color: '#64748b', // slate-500 for dark mode support
        }
      },
      title: {
        display: true,
        text: label,
        color: '#64748b', // slate-500 for dark mode support
      },
    },
    scales:
      !isPie
        ? {
            x: {
              grid: {
                display: false,
                color: 'rgba(100, 116, 139, 0.1)', // slate-400 with low opacity
              },
              ticks: {
                color: '#64748b', // slate-500 for dark mode support
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(100, 116, 139, 0.1)', // slate-400 with low opacity
              },
              ticks: {
                color: '#64748b', // slate-500 for dark mode support
              }
            },
          }
        : {},
    maintainAspectRatio: false, // This will help with responsive sizing
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={options} />;
      case 'line':
        return <Line data={chartData} options={options} />;
      case 'pie':
        return <Pie data={chartData} options={options} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            Unsupported chart type
          </div>
        );
    }
  };

  return (
    <div
      className="w-full h-full min-h-[400px] sm:min-h-[480px] lg:min-h-[560px] bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
      style={{ position: 'relative', height: '100%' }}
    >
      {renderChart()}
    </div>
  );
};

export default ChartRenderer;