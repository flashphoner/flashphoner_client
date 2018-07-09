#!/bin/bash

while read line; do
 echo $line
done<<<$(git log WCS-1096..origin/WCS-1096 --since=10.hours --format=%s)

exit 0