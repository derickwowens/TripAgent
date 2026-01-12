#!/usr/bin/env python3
"""
Generate TripAgent app icons with PIL/Pillow
"""
from PIL import Image, ImageDraw
import os

# Colors
GREEN = '#166534'
WHITE = '#FFFFFF'

def draw_pine_tree(draw, center_x, center_y, size):
    """Draw a simple pine tree silhouette"""
    # Tree trunk
    trunk_width = size * 0.15
    trunk_height = size * 0.25
    trunk_left = center_x - trunk_width / 2
    trunk_top = center_y + size * 0.15
    draw.rectangle(
        [trunk_left, trunk_top, trunk_left + trunk_width, trunk_top + trunk_height],
        fill=WHITE
    )
    
    # Three triangular layers for the tree
    layers = [
        (size * 0.5, size * 0.4),   # Bottom layer (width, height)
        (size * 0.4, size * 0.35),  # Middle layer
        (size * 0.3, size * 0.3),   # Top layer
    ]
    
    y_offset = center_y - size * 0.3
    
    for width, height in layers:
        # Draw triangle
        points = [
            (center_x, y_offset),                    # Top point
            (center_x - width/2, y_offset + height), # Bottom left
            (center_x + width/2, y_offset + height)  # Bottom right
        ]
        draw.polygon(points, fill=WHITE)
        y_offset += height * 0.6  # Overlap layers

def create_icon(filename, size):
    """Create a single icon file"""
    # Create image with green background
    img = Image.new('RGB', (size, size), GREEN)
    draw = ImageDraw.Draw(img)
    
    # Draw pine tree in center
    draw_pine_tree(draw, size/2, size/2, size * 0.6)
    
    # Save
    assets_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
    filepath = os.path.join(assets_dir, filename)
    img.save(filepath, 'PNG')
    print(f'✅ Created {filename} ({size}x{size})')

if __name__ == '__main__':
    print('🎨 Generating TripAgent icons...\n')
    
    try:
        create_icon('icon.png', 1024)
        create_icon('adaptive-icon.png', 432)
        create_icon('splash-icon.png', 200)
        create_icon('favicon.png', 48)
        
        print('\n🎉 All icons generated in mobile/assets/')
    except Exception as e:
        print(f'Error: {e}')
        print('\nMake sure Pillow is installed: pip3 install Pillow')
