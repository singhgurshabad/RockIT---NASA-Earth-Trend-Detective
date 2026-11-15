"""Integration checks on real exported project data, never substitute fixtures."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
import pytest
from fastapi.testclient import TestClient
from main import app, REGIONS, TREND_BY_KEY, CLUSTERS, SERIES, FULL_START, FULL_END
from analysis_engine import analyze_trend

client = TestClient(app)
variables = ["surface_temperature", "precipitation", "soil_moisture", "evapotranspiration"]

@pytest.mark.parametrize("region", [r["id"] for r in REGIONS])
@pytest.mark.parametrize("variable", variables)
def test_every_exported_series_runs_a_complete_mission(region, variable):
    response = client.get('/api/mission', params={"region": region, "variable": variable, "start": FULL_START, "end": FULL_END})
    assert response.status_code == 200, response.text
    mission = response.json()
    result = mission['results'][0]
    exported = TREND_BY_KEY[(region, variable)]
    assert mission['selection']['regions'] == [region]
    assert mission['selection']['variables'] == [variable]
    assert len(result['series'][0]['dates']) == 288
    assert result['trends'][0]['result']['slope_per_decade'] == exported['slope_per_decade']
    assert result['trends'][0]['result']['q_value'] == exported['q_value']
    assert mission['ml']['regions'][0]['cluster'] == next(x['cluster'] for x in CLUSTERS['assignments'] if x['region'] == region)
    assert mission['provenance']['is_development_data'] is False
    assert mission['ml']['run_id'] == mission['provenance']['run_id']


def test_comparison_and_custom_window_are_applied_without_relabeling_ml():
    params = [('region', 'california'), ('region', 'amazon'), ('variable', 'surface_temperature'), ('variable', 'soil_moisture'), ('start', '2010-01'), ('end', '2024-12')]
    response = client.get('/api/mission', params=params)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data['results']) == 2
    for result in data['results']:
        assert len(result['series']) == 2
        assert all(len(s['dates']) == 180 for s in result['series'])
        for trend in result['trends']:
            assert trend['kind'] == 'custom_window'
            assert trend['result']['start'] == '2010-01'
            assert trend['result']['q_value'] is None
            assert trend['result']['significant'] is None
            assert 'HAC' in trend['result']['method']
    assert data['ml']['period'] == ['2001-01', '2024-12']


def test_window_estimator_reproduces_exported_full_record_slope_and_interval():
    for rid in ['california', 'amazon', 'central_andean_puna']:
        points = SERIES[(rid, 'surface_temperature')]['series']
        result, _ = analyze_trend([p['date'] for p in points], [p['value'] for p in points], 'degC', FULL_START, FULL_END)
        original = TREND_BY_KEY[(rid, 'surface_temperature')]
        assert result['slope_per_decade'] == pytest.approx(original['slope_per_decade'], abs=1e-10)
        assert result['ci_low'] == pytest.approx(original['ci_low'], abs=1e-9)


def test_short_window_keeps_graphs_without_inventing_a_trend():
    response = client.get('/api/mission', params={'region': 'california', 'variable': 'precipitation', 'start': '2024-01', 'end': '2024-12'})
    assert response.status_code == 200
    result = response.json()['results'][0]
    assert len(result['series'][0]['values']) == 12
    assert result['trends'][0]['result']['status'] == 'insufficient_data'
    assert result['trends'][0]['result'].get('slope_per_decade') is None


@pytest.mark.parametrize('params', [
    {'region':'not-a-region','variable':'precipitation'},
    {'region':'california','variable':'not-a-variable'},
    {'region':'california','variable':'precipitation','start':'2024-12','end':'2001-01'},
    {'region':'california','variable':'precipitation','start':'2024-13'},
    {'region':'california','variable':'precipitation','start':'2000-01'},
    {'region':'california','variable':'precipitation','end':'2025-01'},
    {'region':'california','variable':'precipitation','start':'NaT'},
])
def test_bad_requests_fail_clearly(params):
    response = client.get('/api/mission',params=params)
    assert response.status_code in [404, 422]
    assert response.json()['detail']


def test_neighbor_distance_uses_the_same_four_training_features():
    data = client.get('/api/clusters', params={'region': 'california'}).json()
    ctx = data['context']
    distances = [n['distance'] for n in ctx['neighbors']]
    assert distances == sorted(distances)
    assert ctx['role'] == 'validation_assignment'
    for neighbor in ctx['neighbors']:
        distance = np.linalg.norm([ctx['fingerprint'][f] - neighbor['fingerprint'][f] for f in data['features']])
        assert neighbor['distance'] == pytest.approx(distance)
        assert neighbor['region'] != 'california'


def test_all_public_endpoints_and_custom_trend_schema():
    for endpoint in ['/api/health', '/api/regions', '/api/variables', '/api/glossary', '/api/discoveries', '/api/clusters', '/api/map-geometry']:
        assert client.get(endpoint).status_code == 200
    assert client.get('/api/trend', params={'region':'california','variable':'precipitation','start':'2024-01','end':'2024-12'}).status_code == 200
    assert client.get('/api/timeseries', params={'region':'unknown','variable':'precipitation'}).status_code == 404
    assert client.get('/api/map-trends', params={'variable':'precipitation'}).status_code == 200
