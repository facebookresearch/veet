#!/bin/bash
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.


set -e

if [ $# -lt 3 ]
then
  SCRIPT_BASENAME=$(basename "$0")
  printf "Usage: ./%s <App bundle path> <BUCK codesign args directory> <Entitlements path>\n\n" "$SCRIPT_BASENAME" 1>&2
  exit 1
fi

APP_BUNDLE_PATH="$1"
CODESIGN_ARGS_DIR="$2"
ENTITLEMENTS_PATH="$3"
APP_NAME=$(basename "$APP_BUNDLE_PATH" .app)

# Root
cp "$CODESIGN_ARGS_DIR"/BUCK_code_sign_args_main.plist "$APP_BUNDLE_PATH"/BUCK_code_sign_args.plist
cp "$ENTITLEMENTS_PATH" "$APP_BUNDLE_PATH"/BUCK_code_sign_entitlements.plist

# Frameworks with default args
for fwkname in \
    "Mantle.framework" \
    "ReactiveObjC.framework" \
    "${APP_NAME} Helper.app" \
    "${APP_NAME} Helper (GPU).app" \
    "${APP_NAME} Helper (Plugin).app" \
    "${APP_NAME} Helper (Renderer).app"; do \

  cp "$CODESIGN_ARGS_DIR"/BUCK_code_sign_args_default.plist "$APP_BUNDLE_PATH"/Contents/Frameworks/"$fwkname"/BUCK_code_sign_args.plist;
  cp "$ENTITLEMENTS_PATH" "$APP_BUNDLE_PATH"/Contents/Frameworks/"$fwkname"/BUCK_code_sign_entitlements.plist;
done;

# Electron Framework.framework
cp "$CODESIGN_ARGS_DIR"/BUCK_code_sign_args_electron.plist "$APP_BUNDLE_PATH"/Contents/Frameworks/'Electron Framework.framework'/BUCK_code_sign_args.plist;
cp "$ENTITLEMENTS_PATH" "$APP_BUNDLE_PATH"/Contents/Frameworks/'Electron Framework.framework'/BUCK_code_sign_entitlements.plist;

# Squirrel
cp "$CODESIGN_ARGS_DIR"/BUCK_code_sign_args_squirrel.plist "$APP_BUNDLE_PATH"/Contents/Frameworks/Squirrel.framework/BUCK_code_sign_args.plist;
cp "$ENTITLEMENTS_PATH" "$APP_BUNDLE_PATH"/Contents/Frameworks/Squirrel.framework/BUCK_code_sign_entitlements.plist;
