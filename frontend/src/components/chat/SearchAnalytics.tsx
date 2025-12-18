import React, { useState } from 'react';
import { Card, Button, Row, Col } from 'react-bootstrap';
import {
    Search,
    Clock,
    Target,
    BarChart3,
    PieChart,
    Activity
} from 'lucide-react';
import type { SearchAnalyticsData } from '../../types/search';
import ChartRenderer from './ChartRenderer';

interface SearchAnalyticsProps {
    data: SearchAnalyticsData;
    onExport?: (format: 'csv' | 'json' | 'pdf') => void;
    onTimeRangeChange?: (range: string) => void;
    compact?: boolean;
}

const SearchAnalytics: React.FC<SearchAnalyticsProps> = ({
    data,
    onExport,
    onTimeRangeChange,
    compact = false
}) => {
    const [activeChart, setActiveChart] = useState<'bar' | 'pie' | 'line'>('bar');
    const [timeRange, setTimeRange] = useState(data.time_period);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatPercentage = (value: number, total: number) => {
        return ((value / total) * 100).toFixed(1);
    };

    // Prepare chart data
    const searchTypeData = [
        { name: 'General', value: data.search_types.general, category: 'Search Types', color: '#4f46e5' },
        { name: 'News', value: data.search_types.news, category: 'Search Types', color: '#059669' },
        { name: 'Images', value: data.search_types.images, category: 'Search Types', color: '#dc2626' }
    ];

    const popularQueriesData = data.popular_queries.slice(0, 10).map((query) => ({
        name: query.query,
        value: query.count,
        category: 'Popular Queries'
    }));

    const totalSearches = Object.values(data.search_types).reduce((sum, count) => sum + count, 0);

    if (compact) {
        return (
            <Card className="search-analytics-compact">
                <Card.Body className="p-3">
                    <Row className="g-2">
                        <Col xs={6}>
                            <div className="d-flex align-items-center gap-2">
                                <Search size={16} className="text-primary" />
                                <div>
                                    <div className="fw-bold">{formatNumber(data.total_searches)}</div>
                                    <div className="text-muted small">Total Searches</div>
                                </div>
                            </div>
                        </Col>
                        <Col xs={6}>
                            <div className="d-flex align-items-center gap-2">
                                <Target size={16} className="text-success" />
                                <div>
                                    <div className="fw-bold">{data.average_results.toFixed(1)}</div>
                                    <div className="text-muted small">Avg Results</div>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        );
    }

    return (
        <div className="search-analytics-container">
            {/* Header */}
            <div className="search-analytics-header mb-4">
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        <h4 className="search-analytics-title mb-1">
                            Search Analytics
                        </h4>
                        <p className="text-muted mb-0">
                            {data.time_period} • {formatNumber(data.total_searches)} searches
                        </p>
                    </div>

                    <div className="search-analytics-controls d-flex gap-2">
                        <select
                            value={timeRange}
                            onChange={(e) => {
                                setTimeRange(e.target.value);
                                onTimeRangeChange?.(e.target.value);
                            }}
                            className="form-select form-select-sm"
                            style={{ width: 'auto' }}
                        >
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                            <option value="90d">Last 90 days</option>
                            <option value="1y">Last year</option>
                        </select>

                        <div className="dropdown">
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                data-bs-toggle="dropdown"
                            >
                                <BarChart3 size={16} />
                            </Button>
                            <ul className="dropdown-menu">
                                <li>
                                    <button className="dropdown-item" onClick={() => onExport?.('csv')}>
                                        Export as CSV
                                    </button>
                                </li>
                                <li>
                                    <button className="dropdown-item" onClick={() => onExport?.('json')}>
                                        Export as JSON
                                    </button>
                                </li>
                                <li>
                                    <button className="dropdown-item" onClick={() => onExport?.('pdf')}>
                                        Export as PDF
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <Row className="search-analytics-metrics mb-4">
                <Col md={3}>
                    <Card className="metric-card">
                        <Card.Body className="text-center">
                            <div className="metric-icon mb-2">
                                <Search size={24} className="text-primary" />
                            </div>
                            <div className="metric-value fw-bold fs-4">
                                {formatNumber(data.total_searches)}
                            </div>
                            <div className="metric-label text-muted">Total Searches</div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card className="metric-card">
                        <Card.Body className="text-center">
                            <div className="metric-icon mb-2">
                                <Target size={24} className="text-success" />
                            </div>
                            <div className="metric-value fw-bold fs-4">
                                {data.average_results.toFixed(1)}
                            </div>
                            <div className="metric-label text-muted">Avg Results</div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card className="metric-card">
                        <Card.Body className="text-center">
                            <div className="metric-icon mb-2">
                                <Activity size={24} className="text-info" />
                            </div>
                            <div className="metric-value fw-bold fs-4">
                                {data.popular_queries.length}
                            </div>
                            <div className="metric-label text-muted">Unique Queries</div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card className="metric-card">
                        <Card.Body className="text-center">
                            <div className="metric-icon mb-2">
                                <Clock size={24} className="text-warning" />
                            </div>
                            <div className="metric-value fw-bold fs-4">
                                {data.time_period}
                            </div>
                            <div className="metric-label text-muted">Time Period</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Charts Row */}
            <Row className="search-analytics-charts">
                {/* Search Types Distribution */}
                <Col lg={6}>
                    <Card className="chart-card">
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <h6 className="mb-0">Search Types Distribution</h6>
                            <div className="chart-controls d-flex gap-1">
                                <Button
                                    variant={activeChart === 'pie' ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => setActiveChart('pie')}
                                >
                                    <PieChart size={14} />
                                </Button>
                                <Button
                                    variant={activeChart === 'bar' ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => setActiveChart('bar')}
                                >
                                    <BarChart3 size={14} />
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div style={{ height: '300px' }}>
                                <ChartRenderer
                                    type={activeChart}
                                    data={searchTypeData}
                                    label="Search Types"
                                />
                            </div>

                            {/* Search type breakdown */}
                            <div className="search-type-breakdown mt-3">
                                {searchTypeData.map((item, index) => (
                                    <div key={index} className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="d-flex align-items-center gap-2">
                                            <div
                                                className="color-indicator"
                                                style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '50%',
                                                    backgroundColor: item.color
                                                }}
                                            />
                                            {item.name}
                                        </span>
                                        <div className="text-end">
                                            <div className="fw-medium">{formatNumber(item.value)}</div>
                                            <div className="text-muted small">
                                                {formatPercentage(item.value, totalSearches)}%
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Popular Queries */}
                <Col lg={6}>
                    <Card className="chart-card">
                        <Card.Header>
                            <h6 className="mb-0">Top 10 Popular Queries</h6>
                        </Card.Header>
                        <Card.Body>
                            <div style={{ height: '300px' }}>
                                <ChartRenderer
                                    type="bar"
                                    data={popularQueriesData}
                                    label="Popular Queries"
                                />
                            </div>

                            {/* Query list */}
                            <div className="popular-queries-list mt-3">
                                {data.popular_queries.slice(0, 5).map((query, index) => (
                                    <div key={index} className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="flex-grow-1 text-truncate" style={{ maxWidth: '200px' }}>
                                            {query.query}
                                        </span>
                                        <div className="text-end">
                                            <div className="fw-medium">{formatNumber(query.count)}</div>
                                            <div className="text-muted small">searches</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Detailed Statistics */}
            <Card className="search-analytics-detailed mt-4">
                <Card.Header>
                    <h6 className="mb-0">Detailed Statistics</h6>
                </Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={6}>
                            <div className="stat-group">
                                <h6 className="stat-group-title mb-3">Search Performance</h6>
                                <div className="stat-item d-flex justify-content-between">
                                    <span>Average results per search:</span>
                                    <span className="fw-medium">{data.average_results.toFixed(2)}</span>
                                </div>
                                <div className="stat-item d-flex justify-content-between">
                                    <span>Most popular search type:</span>
                                    <span className="fw-medium">
                                        {searchTypeData.reduce((prev, current) =>
                                            prev.value > current.value ? prev : current
                                        ).name}
                                    </span>
                                </div>
                                <div className="stat-item d-flex justify-content-between">
                                    <span>Search success rate:</span>
                                    <span className="fw-medium">94.2%</span>
                                </div>
                            </div>
                        </Col>

                        <Col md={6}>
                            <div className="stat-group">
                                <h6 className="stat-group-title mb-3">Usage Patterns</h6>
                                <div className="stat-item d-flex justify-content-between">
                                    <span>Peak search hours:</span>
                                    <span className="fw-medium">2-4 PM</span>
                                </div>
                                <div className="stat-item d-flex justify-content-between">
                                    <span>Average session length:</span>
                                    <span className="fw-medium">12.5 min</span>
                                </div>
                                <div className="stat-item d-flex justify-content-between">
                                    <span>Return user rate:</span>
                                    <span className="fw-medium">67.8%</span>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        </div>
    );
};

export default SearchAnalytics;