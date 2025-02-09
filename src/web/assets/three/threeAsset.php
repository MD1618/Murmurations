<?php

namespace martindrahony\craftmurmurations\web\assets\three;

use Craft;
use craft\web\AssetBundle;

/**
 * Three asset bundle
 */
class threeAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/dist';
    public $depends = [];
    public $js = [];
    public $css = ['css/murmurations.css'];
}
