#!/usr/bin/env python3
"""
tomoe_data (.tdicファイル) をJSON形式に変換するスクリプト
"""
import json
import re
import sys
from pathlib import Path

def parse_tdic(content: str) -> list[dict]:
    """
    .tdicファイルの内容をパースして文字データのリストを返す
    
    形式:
    <文字>
    :<ストローク数>
    <点数> (X1 Y1) (X2 Y2) ...
    ...
    """
    characters = []
    lines = content.strip().split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        
        # コメントや特殊エントリをスキップ
        if line.startswith('旧') or line.startswith('新'):
            # 代替バージョンの文字をスキップ（次の空行まで）
            i += 1
            while i < len(lines) and lines[i].strip():
                i += 1
            continue
        
        # 文字行（:で始まらない、空でない）
        if not line.startswith(':'):
            char = line
            i += 1
            
            if i >= len(lines):
                break
            
            # ストローク数行
            stroke_line = lines[i].strip()
            if not stroke_line.startswith(':'):
                continue
            
            stroke_count = int(stroke_line[1:])
            i += 1
            
            # ストロークデータを読み込み
            strokes = []
            for _ in range(stroke_count):
                if i >= len(lines):
                    break
                
                stroke_line = lines[i].strip()
                if not stroke_line:
                    continue
                
                # 座標をパース: "3 (10 20) (30 40) (50 60)"
                parts = stroke_line.split(')')
                coords = []
                for part in parts:
                    part = part.strip()
                    if '(' in part:
                        coord_str = part[part.find('(')+1:]
                        try:
                            x, y = map(int, coord_str.split())
                            coords.append([x, y])
                        except ValueError:
                            continue
                
                if coords:
                    strokes.append(coords)
                i += 1
            
            if strokes:
                characters.append({
                    'char': char,
                    'strokes': strokes
                })
        else:
            i += 1
    
    return characters

def normalize_strokes(strokes: list[list[list[int]]]) -> list[list[list[float]]]:
    """
    ストロークを正規化（0-1の範囲にスケーリング）
    """
    # 全座標の最小・最大を取得
    all_x = [p[0] for s in strokes for p in s]
    all_y = [p[1] for s in strokes for p in s]
    
    if not all_x or not all_y:
        return []
    
    min_x, max_x = min(all_x), max(all_x)
    min_y, max_y = min(all_y), max(all_y)
    
    # スケール計算（アスペクト比を維持）
    width = max_x - min_x
    height = max_y - min_y
    scale = max(width, height)
    
    if scale == 0:
        scale = 1
    
    normalized = []
    for stroke in strokes:
        norm_stroke = []
        for x, y in stroke:
            norm_x = (x - min_x) / scale
            norm_y = (y - min_y) / scale
            norm_stroke.append([norm_x, norm_y])
        normalized.append(norm_stroke)
    
    return normalized

def main():
    input_file = Path(__file__).parent.parent / 'temp_tomoe_data' / 'all.tdic'
    output_dir = Path(__file__).parent.parent / 'src' / 'data'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Reading {input_file}...")
    content = input_file.read_text(encoding='utf-8')
    
    print("Parsing data...")
    characters = parse_tdic(content)
    print(f"Found {len(characters)} characters")
    
    # 正規化
    print("Normalizing strokes...")
    for char_data in characters:
        char_data['strokes'] = normalize_strokes(char_data['strokes'])
    
    # JSONに保存
    output_file = output_dir / 'characters.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(characters, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"Saved to {output_file}")
    
    # 統計情報
    hiragana = [c for c in characters if '\u3040' <= c['char'] <= '\u309f']
    katakana = [c for c in characters if '\u30a0' <= c['char'] <= '\u30ff']
    kanji = [c for c in characters if '\u4e00' <= c['char'] <= '\u9faf']
    
    print(f"\nStatistics:")
    print(f"  Hiragana: {len(hiragana)}")
    print(f"  Katakana: {len(katakana)}")
    print(f"  Kanji: {len(kanji)}")
    print(f"  Others: {len(characters) - len(hiragana) - len(katakana) - len(kanji)}")

if __name__ == '__main__':
    main()
