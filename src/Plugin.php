<?php

namespace martindrahony\craftmurmurations;

use Craft;
use craft\base\Model;
use craft\base\Plugin as BasePlugin;
use martindrahony\craftmurmurations\models\Settings;
use craft\web\View;
use martindrahony\craftmurmurations\web\assets\three\threeAsset;

/**
 * Murmurations plugin
 *
 * @method static Plugin getInstance()
 * @method Settings getSettings()
 * @author MartinDrahony
 * @copyright MartinDrahony
 * @license https://craftcms.github.io/license/ Craft License
 */
class Plugin extends BasePlugin
{
    public string $schemaVersion = '1.0.0';
    public bool $hasCpSettings = true;

    public static function config(): array
    {
        return [
            'components' => [
                // Define component configs here...
            ],
        ];
    }

    public function init(): void
    {
        parent::init();

        $this->attachEventHandlers();

        // Any code that creates an element query or loads Twig should be deferred until
        // after Craft is fully initialized, to avoid conflicts with other plugins/modules
        Craft::$app->onInit(function() {
            if (
                $this->isInstalled
                && Craft::$app->request->isCpRequest
            ) {
                $request = Craft::$app->getRequest();

                if (Craft::$app->getRequest()->getUrl() === '/admin/login') {
                    // register html in the head
                    
                        Craft::$app->getView()->registerScript('{"imports": {"gsap": "https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js", "three": "https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.webgpu.js","three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.webgpu.js","three/tsl": "https://cdn.jsdelivr.net/npm/three@0.173.0/build/three.tsl.js","three/addons/": "https://cdn.jsdelivr.net/npm/three@0.173.0/examples/jsm/"}}', View::POS_HEAD, [
                        'type' => 'importmap',
                    ]);

                    Craft::$app->getView()->registerHTML('<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>', View::POS_HEAD);

                    // plugins/murmurations/src/web/assets/three/dist/js/murmurations.js as a string from file
                    
                    // get the contents of the file
                    // $threeFile = file_get_contents(__DIR__ . '/threeJSBirds/three.webgpu.js');

                    // Craft::$app->getView()->registerScript($threeFile, View::POS_END, [
                    //     'type' => 'module',
                    // ]);

                    $file = file_get_contents(__DIR__ . '/threeJSBirds/murmurations.js');
                    // register the script
                    Craft::$app->getView()->registerScript($file, View::POS_END, [
                        'type' => 'module',
                    ]);
                    

                    // register asset bundle
                    $this->injectAssetBundle();
                }
            }
        });
    }

    protected function injectAssetBundle(): void
    {
        Craft::$app->getView()->registerAssetBundle(threeAsset::class);
    }

    protected function createSettingsModel(): ?Model
    {
        return Craft::createObject(Settings::class);
    }

    protected function settingsHtml(): ?string
    {
        return Craft::$app->view->renderTemplate('murmurations/_settings.twig', [
            'plugin' => $this,
            'settings' => $this->getSettings(),
        ]);
    }

    private function attachEventHandlers(): void
    {
        // Register event handlers here ...
        // (see https://craftcms.com/docs/5.x/extend/events.html to get started)

        
    }
}
