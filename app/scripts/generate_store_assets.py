"""Generate deterministic Android and store icon assets from store-assets/icon-master.png."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MASTER_PATH = ROOT / "store-assets" / "icon-master.png"
STORE_DIR = ROOT / "store-assets"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_ASSETS = ROOT / "ios" / "App" / "App" / "Assets.xcassets"
NAVY = (7, 9, 48)
PURPLE = (139, 92, 246)
YELLOW = (250, 204, 21)
FONT_BOLD = Path("C:/Windows/Fonts/NotoSansJP-Bold.otf")
FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansJP-Regular.otf")


def square_crop(image: Image.Image) -> Image.Image:
    size = min(image.size)
    left = (image.width - size) // 2
    top = (image.height - size) // 2
    return image.crop((left, top, left + size, top + size))


def save_square(image: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)


def save_round(image: Image.Image, path: Path, size: int) -> None:
    resized = image.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    resized.putalpha(mask)
    path.parent.mkdir(parents=True, exist_ok=True)
    resized.save(path, optimize=True)


def save_splash(image: Image.Image, path: Path) -> None:
    current = Image.open(path)
    canvas = Image.new("RGB", current.size, NAVY)
    icon_size = int(min(current.size) * 0.42)
    icon = image.resize((icon_size, icon_size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (icon_size, icon_size), 0)
    radius = max(1, icon_size // 5)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, icon_size - 1, icon_size - 1), radius=radius, fill=255
    )
    icon.putalpha(mask)
    position = ((current.width - icon_size) // 2, (current.height - icon_size) // 2)
    canvas.paste(icon, position, icon)
    canvas.save(path, optimize=True)


def save_feature_graphic(image: Image.Image, path: Path) -> None:
    width, height = 1024, 500
    canvas = Image.new("RGB", (width, height), NAVY)
    draw = ImageDraw.Draw(canvas)

    for x in range(width):
        blend = x / (width - 1)
        color = (
            int(NAVY[0] * (1 - blend) + 20 * blend),
            int(NAVY[1] * (1 - blend) + 14 * blend),
            int(NAVY[2] * (1 - blend) + 64 * blend),
        )
        draw.line((x, 0, x, height), fill=color)

    draw.ellipse((-150, 265, 410, 825), fill=(25, 18, 83))
    draw.ellipse((810, -220, 1230, 200), fill=(37, 25, 100))
    draw.rounded_rectangle((73, 73, 427, 427), radius=76, fill=(15, 17, 62))

    icon_size = 330
    icon = image.resize((icon_size, icon_size), Image.Resampling.LANCZOS).convert("RGBA")
    icon_mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(icon_mask).rounded_rectangle(
        (0, 0, icon_size - 1, icon_size - 1), radius=70, fill=255
    )
    icon.putalpha(icon_mask)
    canvas.paste(icon, (85, 85), icon)

    title_font = ImageFont.truetype(str(FONT_BOLD), 82)
    body_font = ImageFont.truetype(str(FONT_REGULAR), 31)
    draw.text((492, 135), "ふりろぐ", font=title_font, fill="white")
    draw.rounded_rectangle((494, 244, 614, 252), radius=4, fill=YELLOW)
    draw.text((492, 284), "ダンス動画を、", font=body_font, fill=(226, 228, 255))
    draw.text((492, 332), "フレームで振り返る。", font=body_font, fill=(226, 228, 255))

    draw.ellipse((914, 405, 934, 425), fill=PURPLE)
    draw.ellipse((948, 405, 968, 425), fill=YELLOW)
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)


def main() -> None:
    source = square_crop(Image.open(MASTER_PATH).convert("RGB"))

    save_square(source, STORE_DIR / "app-icon-1024.png", 1024)
    save_square(source, STORE_DIR / "google-play-icon-512.png", 512)
    save_feature_graphic(source, STORE_DIR / "google-play-feature-1024x500.png")
    save_square(source, ROOT / "public" / "app-icon-192.png", 192)
    save_square(source, ROOT / "public" / "app-icon-512.png", 512)

    legacy_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    foreground_sizes = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    for density, size in legacy_sizes.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        save_square(source, folder / "ic_launcher.png", size)
        save_round(source, folder / "ic_launcher_round.png", size)
    for density, size in foreground_sizes.items():
        save_square(source, ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png", size)

    for splash_path in ANDROID_RES.glob("**/splash.png"):
        save_splash(source, splash_path)

    if IOS_ASSETS.exists():
        save_square(
            source,
            IOS_ASSETS / "AppIcon.appiconset" / "AppIcon-512@2x.png",
            1024,
        )
        for splash_path in (IOS_ASSETS / "Splash.imageset").glob("splash-*.png"):
            save_splash(source, splash_path)


if __name__ == "__main__":
    main()
