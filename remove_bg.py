from PIL import Image, ImageDraw

def create_macos_icon(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    original_size = img.size
    
    # 1. Heavily crop inward to guarantee we lose the AI-drawn white stroke border
    # Crop 85px to keep it tight but larger in the transparent padded area
    crop_margin = 85
    cropped = img.crop((crop_margin, crop_margin, img.size[0] - crop_margin, img.size[1] - crop_margin))
    
    # 2. Apply proper macOS rounded corners to this inner square
    mask = Image.new("L", cropped.size, 0)
    draw = ImageDraw.Draw(mask)
    radius = int(cropped.size[0] * 0.225)
    draw.rounded_rectangle([(0, 0), cropped.size], radius=radius, fill=255)
    cropped.putalpha(mask)
    
    # 3. Create a transparent canvas at original size (e.g. 1024x1024)
    # and paste our rounded square in the center. This gives
    # the requisite transparent padding so the icon isn't "oversized" in the Dock.
    canvas = Image.new("RGBA", original_size, (255, 255, 255, 0))
    paste_x = (original_size[0] - cropped.size[0]) // 2
    paste_y = (original_size[1] - cropped.size[1]) // 2
    canvas.paste(cropped, (paste_x, paste_y), cropped)
    
    canvas.save(output_path, "PNG")

if __name__ == "__main__":
    import sys
    create_macos_icon(sys.argv[1], sys.argv[2])
