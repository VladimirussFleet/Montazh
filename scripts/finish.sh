#!/bin/sh
# Финальное сжатие под Instagram: 1080×1920, два прохода, ~4.6 Мбит/с — ролик до минуты весит меньше 30 МБ
# и выглядит чисто после пережатия Instagram.
#   sh scripts/finish.sh hq.mp4 final.mp4 [кбит/с=4600]
B=${3:-4600}
LOG=$(mktemp -u)
ffmpeg -v error -y -i "$1" -c:v libx264 -preset medium -b:v ${B}k -pass 1 -passlogfile "$LOG" -an -f mp4 /dev/null && \
ffmpeg -v error -y -i "$1" -c:v libx264 -preset medium -b:v ${B}k -maxrate 7M -bufsize 12M -pass 2 -passlogfile "$LOG" \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$2"
rm -f "$LOG"*
