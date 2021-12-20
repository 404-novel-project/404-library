#!/bin/bash

curl -fsSL https://deno.land/x/install/install.sh -o /tmp/install_deno.sh && \
source /tmp/install_deno.sh
export DENO_INSTALL="$deno_install"
export PATH="$DENO_INSTALL/bin:$PATH"

echo $PATH
which deno

bash scripts/cache.sh
bash scripts/run.sh  