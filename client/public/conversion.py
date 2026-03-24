import geopandas as gpd
import pandas as pd
import os

def process_geojson():
    print("지리 데이터 병합을 시작합니다...")
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # ---------------------------------------------------------
    # 1. 광역 단위 (metro) 처리
    # ---------------------------------------------------------
    print("1. 광역 지도(metro_fixed.json) 처리 중...")
    metro_path = os.path.join(base_dir, 'metro_fixed.json')
    metro = gpd.read_file(metro_path)
    
    # 도형 오류 사전 방지
    metro['geometry'] = metro['geometry'].buffer(0)

    target_ids = ['29', '46']
    to_merge = metro[metro['id'].astype(str).isin(target_ids)]
    others = metro[~metro['id'].astype(str).isin(target_ids)]
    
    # ✨ 틈새를 메우기 위한 마법의 수치 (위경도 좌표계 기준 약 100~200미터)
    # 만약 선이 여전히 남아있다면 이 숫자를 0.005 정도로 살짝 키워주세요.
    tolerance = 0.002 
    
    # ✨ 팽창 -> 병합 -> 수축 기법 적용
    merged_geom = to_merge.geometry.buffer(tolerance).union_all().buffer(-tolerance)
    
    # 수축 후 혹시 모를 내부 구멍(홀)이나 자투리가 생겼을 경우 부드럽게 한 번 더 정리
    merged_geom = merged_geom.simplify(0.0001, preserve_topology=True)

    new_row = pd.DataFrame([{
        'id': '90',
        'name': '전남광주통합특별시',
        'geometry': merged_geom
    }])
    new_gdf = gpd.GeoDataFrame(new_row, crs=metro.crs)
    
    final_metro = pd.concat([others, new_gdf], ignore_index=True)
    
    output_metro_path = os.path.join(base_dir, 'metro_updated.json')
    final_metro.to_file(output_metro_path, driver='GeoJSON')
    print(f"광역 지도 처리 완료 -> {output_metro_path}")

    # ---------------------------------------------------------
    # 2. 기초 단위 (local) 처리
    # ---------------------------------------------------------
    print("2. 기초 지도(local_fixed.json) 처리 중...")
    local_path = os.path.join(base_dir, 'local_fixed.json')
    local = gpd.read_file(local_path)
    
    def update_local_id(old_id):
        old_str = str(old_id)
        if old_str.startswith('29') or old_str.startswith('46'):
            return '90' + old_str[2:]
        return old_str

    local['id'] = local['id'].apply(update_local_id)
    
    output_local_path = os.path.join(base_dir, 'local_updated.json')
    local.to_file(output_local_path, driver='GeoJSON')
    print(f"기초 지도 처리 완료 -> {output_local_path}")

if __name__ == "__main__":
    process_geojson()
    print("모든 작업이 성공적으로 완료되었습니다!")