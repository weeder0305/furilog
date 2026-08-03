"""Create Google Play and App Store screenshots from clean demo captures."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "store-assets" / "screenshots"
FONT_BOLD = Path("C:/Windows/Fonts/NotoSansJP-Bold.otf")
FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansJP-Regular.otf")
NAVY = (7, 9, 48)
YELLOW = (250, 204, 21)

CAPTURES = [
    (
        "raw-00-home.png",
        "01-organize.png",
        "練習動画をすっきり整理",
        "撮影日・タグ・フォルダで、見返したい動画へすぐアクセス。",
    ),
    (
        "raw-01-watch.png",
        "02-frame-review.png",
        "1フレームずつ動きを確認",
        "スロー再生とフレーム送りで、フォームを細かく振り返る。",
    ),
    (
        "raw-02-sticky.png",
        "03-sticky-notes.png",
        "気づきを色付き付箋で残す",
        "気になる瞬間へ、位置と時刻を保ったメモを記録。",
    ),
]


def fit_font(text: str, max_width: int, start_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > 24:
        font = ImageFont.truetype(str(FONT_BOLD), size)
        box = font.getbbox(text)
        if box[2] - box[0] <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(str(FONT_BOLD), size)


def rounded_image(source: Image.Image, width: int, radius: int) -> Image.Image:
    height = round(source.height * width / source.width)
    resized = source.resize((width, height), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", resized.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, resized.width - 1, resized.height - 1), radius=radius, fill=255
    )
    resized.putalpha(mask)
    return resized


def render(
    source: Image.Image,
    output: Path,
    canvas_size: tuple[int, int],
    screenshot_width: int,
    screenshot_top: int,
    title: str,
    subtitle: str,
) -> None:
    width, height = canvas_size
    canvas = Image.new("RGB", canvas_size, NAVY)
    draw = ImageDraw.Draw(canvas)

    for y in range(height):
        blend = y / max(1, height - 1)
        color = (
            int(16 - 9 * blend),
            int(17 - 8 * blend),
            int(67 - 19 * blend),
        )
        draw.line((0, y, width, y), fill=color)

    accent_radius = width // 3
    draw.ellipse(
        (width - accent_radius, -accent_radius // 2, width + accent_radius, accent_radius),
        fill=(35, 24, 99),
    )
    label_font = ImageFont.truetype(str(FONT_BOLD), round(width * 0.043))
    title_font = fit_font(title, round(width * 0.88), round(width * 0.07))
    subtitle_font = ImageFont.truetype(str(FONT_REGULAR), round(width * 0.026))
    draw.text(
        (round(width * 0.07), round(width * 0.055)),
        "ふりろぐ",
        font=label_font,
        fill=YELLOW,
    )
    draw.text(
        (round(width * 0.07), round(width * 0.12)), title, font=title_font, fill="white"
    )
    draw.text(
        (round(width * 0.07), round(width * 0.215)),
        subtitle,
        font=subtitle_font,
        fill=(218, 221, 249),
    )

    screen = rounded_image(source, screenshot_width, round(width * 0.035))
    screen_x = (width - screen.width) // 2
    shadow_pad = round(width * 0.03)
    shadow = Image.new(
        "RGBA", (screen.width + shadow_pad * 2, screen.height + shadow_pad * 2), (0, 0, 0, 0)
    )
    ImageDraw.Draw(shadow).rounded_rectangle(
        (shadow_pad, shadow_pad, shadow.width - shadow_pad, shadow.height - shadow_pad),
        radius=round(width * 0.04),
        fill=(0, 0, 0, 155),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(width * 0.025)))
    canvas.paste(shadow, (screen_x - shadow_pad, screenshot_top - shadow_pad), shadow)
    canvas.paste(screen, (screen_x, screenshot_top), screen)

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)


def main() -> None:
    google_dir = SOURCE_DIR / "google-play-1080x1920"
    apple_dir = SOURCE_DIR / "app-store-1320x2868"
    for source_name, output_name, title, subtitle in CAPTURES:
        source = Image.open(SOURCE_DIR / source_name).convert("RGB")
        render(source, google_dir / output_name, (1080, 1920), 750, 270, title, subtitle)
        render(source, apple_dir / output_name, (1320, 2868), 1100, 370, title, subtitle)


if __name__ == "__main__":
    main()
