import geopandas as gpd
import pandas as pd
import os

def process_geojson():
    print("지리 데이터 병합을 시작합니다...")

    # 스크립트 파일이 위치한 현재 폴더의 절대 경로
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # ---------------------------------------------------------
    # 1. 광역 단위 (metro) 처리
    # ---------------------------------------------------------
    print("1. 광역 지도(metro_fixed.json) 처리 중...")
    metro_path = os.path.join(base_dir, 'metro_fixed.json')
    metro = gpd.read_file(metro_path)
    
    # ✨ 핵심 해결책: 도형의 꼬인 부분(TopologyException)을 자동으로 치료합니다.
    metro['geometry'] = metro['geometry'].buffer(0)

    target_ids = ['29', '46']
    to_merge = metro[metro['id'].astype(str).isin(target_ids)]
    others = metro[~metro['id'].astype(str).isin(target_ids)]
    
    # ✨ 경고 해결: unary_union 대신 최신 명령어인 union_all() 사용
    merged_geom = to_merge.geometry.union_all()
    
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