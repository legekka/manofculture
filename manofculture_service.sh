#!/bin/bash

SCREEN_TITLE=manofculture
/usr/bin/screen -X -S ${SCREEN_TITLE} kill
/usr/bin/screen -dmS ${SCREEN_TITLE} -O -L -l /opt/bots/manofculture/manofculture_start.sh
screen -S ${SCREEN_TITLE} -X multiuser on
screen -S ${SCREEN_TITLE} -X acladd root
screen -S ${SCREEN_TITLE} -X acladd maiia
