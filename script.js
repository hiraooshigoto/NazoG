// ゲーム状態管理
let currentStage = 0;
let compassHeading = 0;
let tiltX = 0;
let tiltY = 0;
let isHolding = false;
let holdTimer = 0;
let holdStartTime = 0;
let holdInterval = null;
let permissionGranted = false;

// デバッグモード関連
let debugMode = localStorage.getItem('nazoGameDebugMode') === 'true';
let debugKeySequence = '';
const DEBUG_KEY_CODE = 'debug';
const TOTAL_STAGES = 8; // ステージ0（チュートリアル）+ ステージ1〜7

// 滑らかなアニメーション用
let smoothCompassHeading = 0;
let smoothTiltX = 0;
let smoothTiltY = 0;
let animationFrameId = null;

// センサー平滑化用
let sensorHistory = [];
const HISTORY_SIZE = 5;
const SMOOTHING_FACTOR = 0.3;

// 加速度センサー用
let acceleration = { x: 0, y: 0, z: 0 };
let shakeDetected = false;
let shakeCount = 0;
let lastShakeTime = 0;

// ステージ6: バイブレーションモールス信号用
let morseCode = '';
let currentMorseWord = '';
let currentMorsePattern = [];
let playerInput = '';
let isPlayingMorse = false;

// モールス信号パターン定義
const morsePatterns = {
    'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',   'E': '.',
    'F': '..-.',  'G': '--.',   'H': '....',  'I': '..',    'J': '.---',
    'K': '-.-',   'L': '.-..',  'M': '--',    'N': '-.',    'O': '---',
    'P': '.--.',  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
    'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',  'Y': '-.--',
    'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----'
};

// ステージ6用の単語リスト（短くて分かりやすい単語）
const morseWords = ['SOS', 'HI', 'OK', 'GO', 'YES', 'NO', 'UP'];

// ==================== 新ステージシステム ====================

// ステージ定義オブジェクト
const STAGE_DEFINITIONS = {
    1: {
        title: 'ステージ 1',
        description: 'コンパス 45度チャレンジ',
        subtitle: 'スマートフォンを回転させて、コンパスの値を45°にしてください。',
        details: '45°を3秒間維持すればクリアです！',
        type: 'compass',
        target: 45,
        tolerance: 5,
        holdTime: 3000,
        createHTML: () => createCompassStageHTML(1, 45),
        logic: (stage) => handleCompassLogic(stage)
    },
    2: {
        title: 'ステージ 2',
        description: '方角ナビゲーション',
        subtitle: 'スマートフォンを北西の方角に向けてください。',
        details: '北西の方角は315°です。',
        type: 'direction',
        target: 315, // 北西
        tolerance: 10,
        createHTML: () => createDirectionStageHTML(2, 315, '北西', 'NW'),
        logic: (stage) => handleDirectionLogic(stage)
    },
    3: {
        title: 'ステージ 3',
        description: '水平チャレンジ',
        subtitle: 'スマートフォンを水平に保ってください。',
        details: '3秒間水平を維持すればクリアです！',
        type: 'level',
        tolerance: 5,
        holdTime: 3000,
        createHTML: () => createLevelStageHTML(3),
        logic: (stage) => handleLevelLogic(stage)
    },
    4: {
        title: 'ステージ 4',
        description: 'シェイクチャレンジ',
        subtitle: 'スマートフォンを振ってください。',
        details: '5回のシェイクを検出すればクリアです！',
        type: 'shake',
        requiredShakes: 5,
        createHTML: () => createShakeStageHTML(4, 5),
        logic: (stage) => handleShakeLogic(stage)
    },
    5: {
        title: 'ステージ 5',
        description: '複合チャレンジ',
        subtitle: '3つの条件を同時に満たしてください',
        details: 'シェイク3回 + 水平維持 + 北東を向く',
        type: 'compound',
        requiredShakes: 3,
        targetDirection: 45, // 北東
        levelTolerance: 5,
        directionTolerance: 10,
        createHTML: () => createCompoundStageHTML(5),
        logic: (stage) => handleCompoundLogic(stage)
    },
    6: {
        title: 'ステージ 6',
        description: 'モールス信号',
        subtitle: 'バイブレーションで再生されるモールス信号を解読してください',
        details: '正しい英単語を入力してください',
        type: 'morse',
        createHTML: () => createMorseStageHTML(6),
        logic: (stage) => handleMorseLogic(stage)
    },
    7: {
        title: 'ステージ 7',
        description: '光センサーチャレンジ',
        subtitle: 'デバイスのカメラで明るさを検出します',
        details: '明るい場所と暗い場所を交互に移動してください',
        type: 'light',
        createHTML: () => createLightStageHTML(7),
        logic: (stage) => handleLightLogic(stage)
    }
};

// 現在のステージ状態
let stageStates = {
    currentCompleteFlag: false,
    shakeCount: 0,
    holdStartTime: 0,
    isHolding: false,
    currentWord: '',
    lightLevels: []
};

// バイブレーション設定
const VIBRATION_SHORT = 150;  // 短点（ドット）
const VIBRATION_LONG = 450;   // 長点（ダッシュ）
const VIBRATION_PAUSE = 150;  // 信号間の休止
const VIBRATION_LETTER_PAUSE = 300;  // 文字間の休止
const VIBRATION_WORD_PAUSE = 800; // 単語間の休止

// クロスブラウザ対応のバイブレーション関数
function performVibration(duration) {
    try {
        // 標準的な方法
        if (navigator.vibrate) {
            const result = navigator.vibrate(duration);
            console.log(`バイブレーション実行 (${duration}ms):`, result);
            return result;
        }
        // Webkit対応
        else if (navigator.webkitVibrate) {
            const result = navigator.webkitVibrate(duration);
            console.log(`Webkit バイブレーション実行 (${duration}ms):`, result);
            return result;
        }
        // Mozilla対応
        else if (navigator.mozVibrate) {
            const result = navigator.mozVibrate(duration);
            console.log(`Mozilla バイブレーション実行 (${duration}ms):`, result);
            return result;
        }
        
        console.warn('バイブレーション機能が見つかりません');
        return false;
    } catch (error) {
        console.error('バイブレーション実行エラー:', error);
        return false;
    }
}

// DOM要素の取得（グローバル変数として保持）
let stageInfo, permissionModal, successModal, requestPermissionBtn, nextStageBtn, tutorialNextBtn;

// DOM要素を安全に取得する関数
function initDOMElements() {
    try {
        stageInfo = document.getElementById('current-stage');
        permissionModal = document.getElementById('permission-modal');
        successModal = document.getElementById('success-modal');
        requestPermissionBtn = document.getElementById('request-permission');
        nextStageBtn = document.getElementById('next-stage-btn');
        tutorialNextBtn = document.getElementById('tutorial-next');
        
        // 重要な要素の存在確認とログ出力
        const elements = [
            { name: 'stageInfo', element: stageInfo },
            { name: 'permissionModal', element: permissionModal },
            { name: 'successModal', element: successModal },
            { name: 'requestPermissionBtn', element: requestPermissionBtn },
            { name: 'nextStageBtn', element: nextStageBtn },
            { name: 'tutorialNextBtn', element: tutorialNextBtn }
        ];
        
        let allFound = true;
        elements.forEach(({ name, element }) => {
            if (element) {
                console.log(`✅ ${name}: 要素が見つかりました`);
            } else {
                console.error(`❌ ${name}: 要素が見つかりません`);
                allFound = false;
            }
        });
        
        console.log('🔧 DOM要素取得完了:', allFound ? '全要素OK' : '一部要素が不足');
        return allFound;
    } catch (error) {
        console.error('❌ DOM要素取得エラー:', error);
        return false;
    }
}

// センサー値表示要素は動的に取得するため、グローバル定数は削除

// ゲーム初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    // 少し遅延を入れて確実にDOM要素が取得できるようにする
    setTimeout(() => {
        initGame();
    }, 100);
});

function initGame() {
    console.log('🎮 ゲームを初期化中...');
    
    try {
        // DOM要素の初期化
        if (!initDOMElements()) {
            throw new Error('DOM要素の取得に失敗しました');
        }
        
        // DOM要素の再取得（より確実な取得）
        const requestBtn = document.getElementById('request-permission');
        const modal = document.getElementById('permission-modal');
        const nextBtn = document.getElementById('next-stage-btn');
        const tutorialBtn = document.getElementById('tutorial-next');
        
        // 要素の存在確認
        console.log('📋 DOM要素確認:');
        console.log('- request-permission:', !!requestBtn);
        console.log('- permission-modal:', !!modal);
        console.log('- next-stage-btn:', !!nextBtn);
        console.log('- tutorial-next:', !!tutorialBtn);
        
        // 許可ボタンのイベントリスナー
        if (requestBtn) {
            // 既存のイベントリスナーを削除
            requestBtn.removeEventListener('click', requestSensorPermission);
            // 新しいイベントリスナーを追加
            requestBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 許可ボタンクリック！');
                requestSensorPermission();
            });
            console.log('✅ 許可ボタンにイベントリスナーを追加');
        } else {
            console.error('❌ 許可ボタンが見つかりません');
        }
        
        // 次のステージボタン
        if (nextBtn) {
            nextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 次のステージボタンクリック');
                goToNextStage();
            });
            console.log('✅ 次のステージボタンにイベントリスナーを追加');
        }
        
        // チュートリアル次へボタン
        if (tutorialBtn) {
            tutorialBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 チュートリアル次へボタンクリック');
                if (permissionGranted) {
                    goToNextStage();
                } else {
                    alert('センサーへのアクセス許可が必要です。');
                }
            });
            console.log('✅ チュートリアル次へボタンにイベントリスナーを追加');
        }
        
        // ステージ6: モールス信号関連のイベントリスナー
        const playMorseBtn = document.getElementById('play-morse-btn');
        const morseInput = document.getElementById('morse-input');
        const submitMorseBtn = document.getElementById('submit-morse-btn');
        
        if (playMorseBtn) {
            playMorseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 モールス信号再生ボタンクリック');
                if (currentMorseWord) {
                    playMorseVibration(currentMorseWord);
                }
            });
            console.log('✅ モールス信号再生ボタンにイベントリスナーを追加');
        }
        
        if (morseInput) {
            morseInput.addEventListener('input', function(e) {
                console.log('📝 モールス信号入力:', e.target.value);
                checkMorseInput();
            });
            console.log('✅ モールス信号入力フィールドにイベントリスナーを追加');
        }
        
        if (submitMorseBtn) {
            submitMorseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔘 モールス信号送信ボタンクリック');
                checkMorseInput();
            });
            console.log('✅ モールス信号送信ボタンにイベントリスナーを追加');
        }
        
        // ステージ表示を更新
        updateStageDisplay();
        
        // 新ステージシステム初期化
        if (!initializeAllStages()) {
            throw new Error('ステージシステムの初期化に失敗しました');
        }
        
        // 初期ステージの表示設定
        initializeStageDisplay();
        
        // モールス信号ステージの初期化
        stageStates.currentWord = generateNewMorseWord();
        currentMorseWord = stageStates.currentWord; // 互換性のため
        console.log('📡 初期モールス信号の単語:', stageStates.currentWord);
        
        // バイブレーション機能チェック
        const vibrationSupported = checkVibrationSupport();
        console.log('📳 バイブレーション機能サポート:', vibrationSupported);
        
        // バイブレーション非対応時のUIメッセージ
        setTimeout(() => {
            if (!vibrationSupported) {
                const morseStatus = document.getElementById('morse-status');
                if (morseStatus) {
                    morseStatus.innerHTML = `
                        ⚠️ バイブレーション機能が利用できません<br>
                        視覚的フィードバックでモールス信号を確認してください
                    `;
                    morseStatus.style.color = '#ff6b6b';
                }
                
                const playButton = document.getElementById('play-morse-btn');
                if (playButton) {
                    playButton.textContent = '👁️ 視覚的モールス信号を再生';
                }
            }
        }, 1000);
        
        // 環境情報をログ出力
        console.log('🌐 環境情報:');
        console.log('- URL:', window.location.href);
        console.log('- Protocol:', window.location.protocol);
        console.log('- User Agent:', navigator.userAgent.substring(0, 50) + '...');
        console.log('- Vibration Support:', vibrationSupported);
        
        // センサー許可状況をチェック
        checkSensorPermissionStatus();
        
        console.log('✅ ゲーム初期化完了');
        
    } catch (error) {
        console.error('❌ ゲーム初期化エラー:', error);
        alert('ゲームの初期化でエラーが発生しました:\n' + error.message);
    }
}

// センサー許可要求
async function requestSensorPermission() {
    console.log('🔐 センサー許可を要求中...');
    console.log('User Agent:', navigator.userAgent);
    
    try {
        // iOS判定
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        console.log('📱 デバイス判定:', { isIOS, isAndroid });
        
        // iOS 13+ でのセンサー許可要求
        if (isIOS && typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('🍎 iOS 13+ センサー許可要求開始');
            
            const orientationPermission = await DeviceOrientationEvent.requestPermission();
            console.log('📐 DeviceOrientation許可結果:', orientationPermission);
            
            // DeviceMotionEventの許可要求（利用可能な場合）
            let motionPermission = 'granted';
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                motionPermission = await DeviceMotionEvent.requestPermission();
                console.log('🏃 DeviceMotion許可結果:', motionPermission);
            }
            
            if (orientationPermission === 'granted') {
                console.log('✅ iOS センサー許可成功');
                permissionGranted = true;
                startSensorListening();
                closePermissionModal();
                return;
            } else {
                console.log('❌ iOS センサー許可拒否');
                throw new Error('センサーアクセスが拒否されました');
            }
        } 
        // Android または旧iOS
        else {
            console.log('🤖 Android/旧iOS - 直接センサー開始');
            permissionGranted = true;
            startSensorListening();
            closePermissionModal();
        }
        
    } catch (error) {
        console.error('❌ センサー許可処理エラー:', error);
        
        // フォールバック: デモモードで開始
        console.log('🔧 デモモードで開始');
        permissionGranted = true;
        closePermissionModal();
        startDemoMode();
    }
}

// デモモード（センサーが利用できない場合のフォールバック）
function startDemoMode() {
    console.log('🎮 デモモード開始');
    
    // デモ用のランダム値を継続的に更新
    let demoAngle = 0;
    let demoTiltX = 0;
    let demoTiltY = 0;
    
    const demoInterval = setInterval(() => {
        // ゆっくりと変化するデモ値
        demoAngle = (demoAngle + 2) % 360;
        demoTiltX = Math.sin(Date.now() / 3000) * 10;
        demoTiltY = Math.cos(Date.now() / 2500) * 8;
        
        // センサー値を更新
        compassHeading = Math.round(demoAngle);
        tiltX = Math.round(demoTiltX);
        tiltY = Math.round(demoTiltY);
        
        // アニメーション開始
        if (!animationFrameId) {
            startSmoothAnimation();
        }
    }, 100);
    
    // デモモードの表示
    setTimeout(() => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 20px; left: 20px; right: 20px;
            background: rgba(255, 165, 0, 0.9); color: white; padding: 15px;
            border-radius: 5px; z-index: 10000; font-size: 14px; text-align: center;
        `;
        modal.innerHTML = '🎮 デモモード: センサーの代わりに疑似データを使用中';
        document.body.appendChild(modal);
        
        setTimeout(() => modal.remove(), 5000);
    }, 1000);
}

function closePermissionModal() {
    console.log('許可モーダルを閉じます');
    try {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            console.log('✅ 許可モーダルが閉じられました');
        } else {
            console.error('❌ 許可モーダル要素が見つかりません');
        }
    } catch (error) {
        console.error('モーダル終了エラー:', error);
    }
}

// センサーリスニング開始
function startSensorListening() {
    console.log('📱 センサーリスニングを開始します');
    
    try {
        // 既存のイベントリスナーを削除（重複を防ぐ）
        window.removeEventListener('deviceorientation', handleOrientation);
        window.removeEventListener('devicemotion', handleMotion);
        console.log('既存のイベントリスナーを削除');
        
        // デバイス方向イベント - パッシブリスナーとして追加
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        console.log('✅ deviceorientationイベントリスナーを追加 (passive)');
        
        // デバイスモーションイベント
        window.addEventListener('devicemotion', handleMotion, { passive: true });
        console.log('✅ devicemotionイベントリスナーを追加 (passive)');
        
        // 初期値設定とテスト
        setTimeout(() => {
            console.log('📊 1秒後のセンサー値:', { compassHeading, tiltX, tiltY });
            
            // センサーが動作していない場合の検出と対策
            if (compassHeading === 0 && tiltX === 0 && tiltY === 0) {
                console.warn('⚠️ センサー値が0のまま - テストモードを開始');
                
                // ダミー値でテスト
                compassHeading = 45;
                tiltX = 5;
                tiltY = 3;
                
                // アニメーション開始
                if (!animationFrameId) {
                    startSmoothAnimation();
                }
                
                console.log('🧪 テストモードでセンサー値を設定しました');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ センサーリスニング開始エラー:', error);
        alert('センサーの初期化でエラーが発生しました。\nページを再読み込みしてください。');
    }
}

// 角度の最短パス計算
function getShortestAngleDifference(current, target) {
    let diff = target - current;
    if (diff > 180) {
        diff -= 360;
    } else if (diff < -180) {
        diff += 360;
    }
    return diff;
}

// センサー値の平滑化
function smoothSensorValue(newValue, currentSmooth, factor = SMOOTHING_FACTOR) {
    return currentSmooth + (newValue - currentSmooth) * factor;
}

// センサーヒストリーに追加
function addToSensorHistory(compass, tiltX, tiltY) {
    sensorHistory.push({ compass, tiltX, tiltY, timestamp: Date.now() });
    if (sensorHistory.length > HISTORY_SIZE) {
        sensorHistory.shift();
    }
}

// デバイス方向ハンドラー
function handleOrientation(event) {
    // デバッグ用：初回のイベント受信をログ
    if (!window.firstOrientationReceived) {
        console.log('初回デバイス方向イベント受信:', event);
        window.firstOrientationReceived = true;
    }
    
    // コンパス値を取得（webkitCompassHeadingがあればそれを使用、なければalphaを使用）
    let heading = event.webkitCompassHeading;
    
    // iOSとAndroidでの処理の違いを考慮
    if (heading === undefined || heading === null) {
        heading = event.alpha;
        if (heading !== null) {
            // Androidの場合、alphaを使用して計算
            heading = (360 - heading) % 360;
        }
    }
    
    // コンパス値が取得できない場合のフォールバック
    if (heading === null || heading === undefined) {
        console.warn('コンパス値を取得できません');
        heading = 0;
    }
    
    // 0-360の範囲に正規化
    let newCompassHeading = Math.round((heading + 360) % 360);
    let newTiltX = Math.round(event.beta || 0);  // 前後の傾き（X軸回転）
    let newTiltY = Math.round(event.gamma || 0); // 左右の傾き（Y軸回転）
    
    // センサーヒストリーに追加
    addToSensorHistory(newCompassHeading, newTiltX, newTiltY);
    
    // 生の値を更新
    compassHeading = newCompassHeading;
    tiltX = newTiltX;
    tiltY = newTiltY;
    
    // アニメーションが開始されていない場合は開始
    if (!animationFrameId) {
        startSmoothAnimation();
    }
}

// 滑らかなアニメーション開始
let lastLogicTime = 0;
const LOGIC_INTERVAL = 100; // ステージロジックを100msごとに実行

function startSmoothAnimation() {
    function animate() {
        const now = performance.now();
        
        // コンパス値の滑らかな更新（360度問題を解決）
        let compassDiff = getShortestAngleDifference(smoothCompassHeading, compassHeading);
        smoothCompassHeading += compassDiff * SMOOTHING_FACTOR;
        
        // 360度境界での正規化
        if (smoothCompassHeading < 0) {
            smoothCompassHeading += 360;
        } else if (smoothCompassHeading >= 360) {
            smoothCompassHeading -= 360;
        }
        
        // 傾きの滑らかな更新
        smoothTiltX = smoothSensorValue(tiltX, smoothTiltX);
        smoothTiltY = smoothSensorValue(tiltY, smoothTiltY);
        
        // UI更新（毎フレーム）
        updateSensorDisplaySmooth();
        updateNeedlePositions();
        
        // ステージロジックは頻度を下げて実行
        if (now - lastLogicTime > LOGIC_INTERVAL) {
            handleStageLogic();
            
            // デバッグパネルの更新（ステージロジックと同じタイミング）
            if (debugMode) {
                updateDebugPanel();
            }
            
            lastLogicTime = now;
        }
        
        // 次のフレームをスケジュール
        animationFrameId = requestAnimationFrame(animate);
    }
    
    animate();
}

// アニメーション停止
function stopSmoothAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log('📱 スムーズアニメーション停止');
    }
}

// 滑らかなセンサー値表示更新
function updateSensorDisplaySmooth() {
    // チュートリアル（ステージ0）のセンサー表示
    const compassValueEl = document.getElementById('compass-value');
    const tiltXEl = document.getElementById('tilt-x');
    const tiltYEl = document.getElementById('tilt-y');
    
    if (compassValueEl) compassValueEl.textContent = `${Math.round(smoothCompassHeading)}°`;
    if (tiltXEl) tiltXEl.textContent = `${Math.round(smoothTiltX)}°`;
    if (tiltYEl) tiltYEl.textContent = `${Math.round(smoothTiltY)}°`;
}

// 針の位置更新（新システム対応）
function updateNeedlePositions() {
    // 現在のステージの針のみを更新
    if (currentStage > 0) {
        const stageDef = STAGE_DEFINITIONS[currentStage];
        if (!stageDef) return;
        
        // コンパス系の針
        if (['compass', 'direction', 'compound'].includes(stageDef.type)) {
            const needleId = stageDef.type === 'compass' ? `compass-needle-${currentStage}` :
                           stageDef.type === 'direction' ? `direction-needle-${currentStage}` :
                           `mini-compass-needle-${currentStage}`;
            
            const displayId = stageDef.type === 'compass' ? `compass-display-${currentStage}` :
                            stageDef.type === 'direction' ? `direction-compass-display-${currentStage}` :
                            `mini-compass-display-${currentStage}`;
            
            const needleEl = document.getElementById(needleId);
            const displayEl = document.getElementById(displayId);
            
            if (needleEl) {
                needleEl.style.transform = `translate(-50%, -100%) rotate(${smoothCompassHeading}deg)`;
            }
            if (displayEl) {
                displayEl.textContent = `${Math.round(smoothCompassHeading)}°`;
            }
        }
        
        // 水平バブルの更新
        if (['level', 'compound'].includes(stageDef.type)) {
            const levelBubble = document.getElementById(`level-bubble-${currentStage}`);
            if (levelBubble) {
                const maxOffset = 40;
                const offsetX = Math.max(-maxOffset, Math.min(maxOffset, smoothTiltY * 2));
                const offsetY = Math.max(-maxOffset, Math.min(maxOffset, smoothTiltX * 2));
                levelBubble.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
            }
        }
    }
}

// デバイスモーションハンドラー（加速度センサー）
function handleMotion(event) {
    if (!event.accelerationIncludingGravity) return;
    
    // 加速度値を取得
    acceleration.x = event.accelerationIncludingGravity.x || 0;
    acceleration.y = event.accelerationIncludingGravity.y || 0;
    acceleration.z = event.accelerationIncludingGravity.z || 0;
    
    // シェイク検出
    const accelerationMagnitude = Math.sqrt(
        acceleration.x * acceleration.x + 
        acceleration.y * acceleration.y + 
        acceleration.z * acceleration.z
    );
    
    // シェイク閾値（調整可能）
    const SHAKE_THRESHOLD = 15;
    const SHAKE_COOLDOWN = 500; // ミリ秒
    
    if (accelerationMagnitude > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShakeTime > SHAKE_COOLDOWN) {
            shakeDetected = true;
            stageStates.shakeCount++;
            lastShakeTime = now;
            console.log('シェイク検出:', stageStates.shakeCount);
        }
    }
}

// 廃止: updateSensorDisplay - updateSensorDisplaySmoothに置き換え
// この関数は滑らかなアニメーション実装により不要

// ==================== 新ステージロジック処理 ====================

// メインステージロジック処理
function handleStageLogic() {
    // ステージ0（チュートリアル）はスキップ
    if (currentStage === 0) return;
    
    // ステージ定義を取得
    const stageDef = STAGE_DEFINITIONS[currentStage];
    if (!stageDef) {
        console.error(`❌ ステージ${currentStage}の定義が見つかりません`);
        return;
    }
    
    // 既にクリア済みの場合はスキップ
    if (stageStates.currentCompleteFlag) {
        return;
    }
    
    // ステージロジックを実行
    try {
        if (stageDef.logic) {
            stageDef.logic(stageDef);
        }
    } catch (error) {
        console.error(`❌ ステージ${currentStage}のロジック実行エラー:`, error);
    }
}

// ==================== HTML生成関数群 ====================

// ステージ1: コンパス45度チャレンジのHTML生成
function createCompassStageHTML(stageNum, target) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p>スマートフォンを回転させて、コンパスの値を<strong>${target}°</strong>にしてください。</p>
            <p>${target}°を3秒間維持すればクリアです！</p>
            
            <div class="compass-display">
                <div class="compass-circle">
                    <div class="compass-needle" id="compass-needle-${stageNum}"></div>
                    <div class="compass-directions">
                        <span class="direction north">N</span>
                        <span class="direction east">E</span>
                        <span class="direction south">S</span>
                        <span class="direction west">W</span>
                    </div>
                </div>
                <div class="compass-value-large" id="compass-display-${stageNum}">${target}°</div>
            </div>
            
            <div class="target-info">
                <p>目標: ${target}°</p>
                <div class="progress-bar">
                    <div class="progress-fill" id="hold-progress-${stageNum}"></div>
                </div>
                <p id="hold-timer-${stageNum}">0.0秒維持中</p>
            </div>
        </div>
    `;
}

// ステージ2: 方角ナビゲーションのHTML生成
function createDirectionStageHTML(stageNum, target, directionName, directionCode) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p>スマートフォンを<strong>${directionName}</strong>の方角に向けてください。</p>
            <p>${directionName}の方角は${target}°です。</p>
            
            <div class="direction-display">
                <div class="current-direction" id="current-direction-${stageNum}">北</div>
                <div class="direction-compass">
                    <div class="direction-needle" id="direction-needle-${stageNum}"></div>
                    <div class="direction-labels">
                        <span class="dir-label" style="top: 10px;">N<br>北</span>
                        <span class="dir-label" style="top: 30px; right: 30px;">NE<br>東北</span>
                        <span class="dir-label" style="right: 10px;">E<br>東</span>
                        <span class="dir-label" style="bottom: 30px; right: 30px;">SE<br>南東</span>
                        <span class="dir-label" style="bottom: 10px;">S<br>南</span>
                        <span class="dir-label" style="bottom: 30px; left: 30px;">SW<br>南西</span>
                        <span class="dir-label" style="left: 10px;">W<br>西</span>
                        <span class="dir-label" style="top: 30px; left: 30px;">NW<br>北西</span>
                    </div>
                </div>
                <div class="compass-value-large" id="direction-compass-display-${stageNum}">0°</div>
            </div>
            
            <div class="target-direction">
                <p>目標方角: ${directionName}（${directionCode}） - ${target}°</p>
                <div class="accuracy-indicator" id="accuracy-indicator-${stageNum}">
                    <span id="accuracy-text-${stageNum}">方角を調整してください</span>
                </div>
            </div>
        </div>
    `;
}

// ステージ3: 水平チャレンジのHTML生成
function createLevelStageHTML(stageNum) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p>スマートフォンを<strong>水平</strong>に保ってください。</p>
            <p>3秒間水平を維持すればクリアです！</p>
            
            <div class="level-display">
                <div class="level-circle">
                    <div class="level-bubble" id="level-bubble-${stageNum}"></div>
                    <div class="level-crosshair"></div>
                </div>
                
                <div class="level-info">
                    <div id="tilt-magnitude-${stageNum}">傾き: 0°</div>
                    <div class="accuracy-indicator" id="level-indicator-${stageNum}">
                        <span id="level-timer-${stageNum}">0.0秒維持中</span>
                    </div>
                    
                    <div class="progress-bar">
                        <div class="progress-fill" id="level-progress-${stageNum}"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ステージ4: シェイクチャレンジのHTML生成
function createShakeStageHTML(stageNum, requiredShakes) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p>スマートフォンを<strong>振って</strong>ください。</p>
            <p>${requiredShakes}回のシェイクを検出すればクリアです！</p>
            
            <div class="shake-display">
                <div class="shake-icon">📱</div>
                <div class="shake-count-display" id="shake-count-${stageNum}">0 / ${requiredShakes}</div>
                
                <div class="shake-instruction">
                    <p>デバイスを上下に振ってください</p>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" id="shake-progress-${stageNum}"></div>
                </div>
            </div>
        </div>
    `;
}

// ステージ5: 複合チャレンジのHTML生成
function createCompoundStageHTML(stageNum) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p><strong>複合チャレンジ</strong></p>
            <p>以下の3つの条件を同時に満たしてください：</p>
            
            <div class="compound-challenge">
                <div class="challenge-conditions">
                    <div class="condition-indicator" id="direction-indicator-${stageNum}">
                        北東向き: ✗ (0°差)
                    </div>
                    <div class="condition-indicator" id="level-indicator-${stageNum}">
                        水平: ✗ (0°傾き)
                    </div>
                    <div class="condition-indicator" id="shake-indicator-${stageNum}">
                        シェイク: 0/3
                    </div>
                </div>
                
                <div class="final-status" id="final-status-${stageNum}">
                    条件を満たしてください
                </div>
                
                <div class="mini-compass">
                    <div class="mini-compass-circle">
                        <div class="mini-compass-needle" id="mini-compass-needle-${stageNum}"></div>
                        <div class="mini-compass-directions">
                            <span class="mini-direction north">N</span>
                            <span class="mini-direction east">E</span>
                            <span class="mini-direction south">S</span>
                            <span class="mini-direction west">W</span>
                        </div>
                    </div>
                    <div class="mini-compass-value" id="mini-compass-display-${stageNum}">0°</div>
                </div>
            </div>
        </div>
    `;
}

// ステージ6: モールス信号のHTML生成
function createMorseStageHTML(stageNum) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p><strong>モールス信号</strong>を解読してください。</p>
            <p>バイブレーションで再生されるモールス信号を聞いて、正しい英単語を入力してください。</p>
            
            <div class="morse-display">
                <div class="morse-instruction">
                    <div class="morse-legend">
                        <div class="morse-legend-item">
                            <span class="morse-dot">●</span>
                            <span>短い振動 = ドット (.)</span>
                        </div>
                        <div class="morse-legend-item">
                            <span class="morse-dash">━</span>
                            <span>長い振動 = ダッシュ (-)</span>
                        </div>
                    </div>
                </div>
                
                <div class="morse-controls">
                    <button id="play-morse-btn-${stageNum}" class="next-button morse-button">
                        📳 モールス信号を再生
                    </button>
                    
                    <div class="morse-visual-container">
                        <div class="morse-visual" id="morse-visual-${stageNum}"></div>
                        <div class="morse-visual-label">視覚的フィードバック</div>
                    </div>
                    
                    <div class="morse-status" id="morse-status-${stageNum}">
                        新しいモールス信号を再生する準備ができました
                    </div>
                </div>
                
                <div class="morse-input-section">
                    <label for="morse-input-${stageNum}" class="morse-label">解読した英単語を入力:</label>
                    <input type="text" id="morse-input-${stageNum}" class="morse-input" placeholder="例: SOS" maxlength="8" autocomplete="off">
                    
                    <div class="morse-hint" id="morse-hint-${stageNum}"></div>
                    
                    <button id="submit-morse-btn-${stageNum}" class="next-button morse-submit">
                        答えを送信
                    </button>
                </div>
                
                <div class="morse-help">
                    <details>
                        <summary>モールス信号表を見る</summary>
                        <div class="morse-table">
                            <div class="morse-table-row">
                                <span>A: ●━</span>
                                <span>B: ━●●●</span>
                                <span>C: ━●━●</span>
                                <span>D: ━●●</span>
                                <span>E: ●</span>
                            </div>
                            <div class="morse-table-row">
                                <span>F: ●●━●</span>
                                <span>G: ━━●</span>
                                <span>H: ●●●●</span>
                                <span>I: ●●</span>
                                <span>J: ●━━━</span>
                            </div>
                            <div class="morse-table-row">
                                <span>K: ━●━</span>
                                <span>L: ●━●●</span>
                                <span>M: ━━</span>
                                <span>N: ━●</span>
                                <span>O: ━━━</span>
                            </div>
                            <div class="morse-table-row">
                                <span>P: ●━━●</span>
                                <span>Q: ━━●━</span>
                                <span>R: ●━●</span>
                                <span>S: ●●●</span>
                                <span>T: ━</span>
                            </div>
                            <div class="morse-table-row">
                                <span>U: ●●━</span>
                                <span>V: ●●●━</span>
                                <span>W: ●━━</span>
                                <span>X: ━●●━</span>
                                <span>Y: ━●━━</span>
                                <span>Z: ━━●●</span>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;
}

// ステージ7: 光センサーチャレンジのHTML生成
function createLightStageHTML(stageNum) {
    return `
        <div class="puzzle-content">
            <h2>ステージ ${stageNum}</h2>
            <p><strong>光センサーチャレンジ</strong></p>
            <p>デバイスのカメラで明るさを検出します。</p>
            <p>明るい場所と暗い場所を交互に移動してください。</p>
            
            <div class="light-display">
                <div class="light-sensor-visual">
                    <div class="light-circle" id="light-circle-${stageNum}">
                        <div class="light-level-indicator" id="light-level-indicator-${stageNum}"></div>
                    </div>
                    <div class="light-value" id="light-value-${stageNum}">待機中...</div>
                </div>
                
                <div class="light-instructions">
                    <p>1. 「カメラ開始」ボタンを押してください</p>
                    <p>2. 明るい場所に移動（3秒間）</p>
                    <p>3. 暗い場所に移動（3秒間）</p>
                    <p>4. 再び明るい場所に移動（3秒間）</p>
                </div>
                
                <div class="light-controls">
                    <button id="start-camera-btn-${stageNum}" class="next-button">📷 カメラ開始</button>
                    <button id="stop-camera-btn-${stageNum}" class="next-button" style="display: none;">⏹️ カメラ停止</button>
                </div>
                
                <div class="light-progress">
                    <div class="light-step" id="light-step-1-${stageNum}">
                        <span class="step-icon">☀️</span>
                        <span class="step-text">明るい場所 (1/3)</span>
                        <div class="step-progress" id="light-progress-1-${stageNum}">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    <div class="light-step" id="light-step-2-${stageNum}">
                        <span class="step-icon">🌙</span>
                        <span class="step-text">暗い場所 (2/3)</span>
                        <div class="step-progress" id="light-progress-2-${stageNum}">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    <div class="light-step" id="light-step-3-${stageNum}">
                        <span class="step-icon">☀️</span>
                        <span class="step-text">明るい場所 (3/3)</span>
                        <div class="step-progress" id="light-progress-3-${stageNum}">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                </div>
                
                <div class="light-status" id="light-status-${stageNum}">
                    カメラを開始して光センサーチャレンジを始めてください
                </div>
                
                <video id="light-camera-${stageNum}" style="display: none;" autoplay></video>
                <canvas id="light-canvas-${stageNum}" style="display: none;"></canvas>
            </div>
        </div>
    `;
}

// ==================== ステージ生成・管理関数 ====================

// 動的ステージ生成
function createStage(stageNum) {
    const stageDef = STAGE_DEFINITIONS[stageNum];
    if (!stageDef) {
        console.error(`ステージ${stageNum}の定義が見つかりません`);
        return null;
    }
    
    console.log(`🏗️ ステージ${stageNum}を生成中: ${stageDef.title}`);
    
    const stageElement = document.createElement('div');
    stageElement.id = `stage-${stageNum}`;
    stageElement.className = 'stage';
    stageElement.innerHTML = stageDef.createHTML();
    
    return stageElement;
}

// 全ステージを生成してコンテナに追加
function initializeAllStages() {
    const container = document.getElementById('dynamic-stages-container');
    if (!container) {
        console.error('❌ dynamic-stages-container が見つかりません');
        return false;
    }
    
    // 既存のステージをクリア
    container.innerHTML = '';
    
    // ステージ1〜7を生成
    for (let i = 1; i <= 7; i++) {
        const stageElement = createStage(i);
        if (stageElement) {
            container.appendChild(stageElement);
            console.log(`✅ ステージ${i}を追加しました`);
        }
    }
    
    // ステージのイベントリスナーを設定
    setupStageEventListeners();
    
    console.log('🎮 全ステージの生成が完了しました');
    return true;
}

// ステージのイベントリスナー設定
function setupStageEventListeners() {
    console.log('🔗 ステージイベントリスナーを設定中...');
    
    // 各ステージのイベントリスナーを設定
    for (let i = 1; i <= 7; i++) {
        setupStageSpecificListeners(i);
    }
    
    console.log('✅ 全ステージのイベントリスナー設定完了');
}

// ステージ固有のイベントリスナー設定
function setupStageSpecificListeners(stageNum) {
    const stageDef = STAGE_DEFINITIONS[stageNum];
    if (!stageDef) return;
    
    switch (stageDef.type) {
        case 'morse':
            setupMorseListeners(stageNum);
            break;
        case 'light':
            setupLightListeners(stageNum);
            break;
    }
}

// モールス信号のイベントリスナー設定
function setupMorseListeners(stageNum) {
    const playMorseBtn = document.getElementById(`play-morse-btn-${stageNum}`);
    const submitMorseBtn = document.getElementById(`submit-morse-btn-${stageNum}`);
    
    if (playMorseBtn) {
        playMorseBtn.addEventListener('click', () => {
            console.log(`🔘 ステージ${stageNum}: モールス信号再生ボタンクリック`);
            const word = stageStates.currentWord || generateNewMorseWord();
            stageStates.currentWord = word;
            playMorseVibration(word, stageNum);
        });
        console.log(`✅ ステージ${stageNum}: モールス再生ボタンのイベントリスナー設定`);
    }
    
    if (submitMorseBtn) {
        submitMorseBtn.addEventListener('click', () => {
            console.log(`🔘 ステージ${stageNum}: モールス信号送信ボタンクリック`);
            checkMorseInput(stageNum);
        });
        console.log(`✅ ステージ${stageNum}: モールス送信ボタンのイベントリスナー設定`);
    }
    
    // モールス入力フィールドのリアルタイムチェック
    const morseInput = document.getElementById(`morse-input-${stageNum}`);
    if (morseInput) {
        morseInput.addEventListener('input', () => {
            updateMorseHint(stageNum);
        });
    }
}

// 光センサーのイベントリスナー設定
function setupLightListeners(stageNum) {
    const startCameraBtn = document.getElementById(`start-camera-btn-${stageNum}`);
    const stopCameraBtn = document.getElementById(`stop-camera-btn-${stageNum}`);
    
    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', () => {
            console.log(`🔘 ステージ${stageNum}: カメラ開始ボタンクリック`);
            startLightSensor();
        });
        console.log(`✅ ステージ${stageNum}: カメラ開始ボタンのイベントリスナー設定`);
    }
    
    if (stopCameraBtn) {
        stopCameraBtn.addEventListener('click', () => {
            console.log(`🔘 ステージ${stageNum}: カメラ停止ボタンクリック`);
            stopLightSensor();
        });
        console.log(`✅ ステージ${stageNum}: カメラ停止ボタンのイベントリスナー設定`);
    }
}

// ==================== 新ロジック処理関数群 ====================

// コンパスロジック処理
function handleCompassLogic(stageDef) {
    const stageNum = currentStage;
    const target = stageDef.target;
    const tolerance = stageDef.tolerance;
    
    // UI要素を取得
    const progressEl = document.getElementById(`hold-progress-${stageNum}`);
    const timerEl = document.getElementById(`hold-timer-${stageNum}`);
    
    // 目標角度との差を計算
    const angleDiff = Math.abs(getShortestAngleDifference(smoothCompassHeading, target));
    const isNearTarget = angleDiff <= tolerance;
    
    // デバッグ情報をログ出力（時々）
    if (Math.random() < 0.01) { // 1%の確率でログ出力
        console.log(`🧭 コンパス - 現在:${Math.round(smoothCompassHeading)}° 目標:${target}° 差:${Math.round(angleDiff)}° 許容:${tolerance}° 範囲内:${isNearTarget}`);
    }
    
    if (isNearTarget && !stageStates.isHolding) {
        // 保持開始
        stageStates.isHolding = true;
        stageStates.holdStartTime = Date.now();
        console.log(`✅ コンパス保持開始 - 目標角度内に入りました`);
    } else if (!isNearTarget && stageStates.isHolding) {
        // 保持中断
        stageStates.isHolding = false;
        stageStates.holdTimer = 0;
        console.log(`❌ コンパス保持中断 - 目標角度から外れました`);
    }
    
    if (stageStates.isHolding) {
        const holdTime = Date.now() - stageStates.holdStartTime;
        const progress = Math.min((holdTime / stageDef.holdTime) * 100, 100);
        
        if (progressEl) progressEl.style.width = `${progress}%`;
        if (timerEl) timerEl.textContent = `${(holdTime / 1000).toFixed(1)}秒維持中 (${Math.round(angleDiff)}°差)`;
        
        if (holdTime >= stageDef.holdTime && !stageStates.currentCompleteFlag) {
            stageStates.currentCompleteFlag = true;
            console.log(`🎉 ステージ${stageNum}クリア！`);
            stageComplete(`${stageDef.title}クリア！\n${target}°を3秒間維持できました！`);
        }
    } else {
        if (progressEl) progressEl.style.width = '0%';
        if (timerEl) timerEl.textContent = `0.0秒維持中 (${Math.round(angleDiff)}°差)`;
    }
}

// 方角ロジック処理
function handleDirectionLogic(stageDef) {
    const stageNum = currentStage;
    const target = stageDef.target;
    const tolerance = stageDef.tolerance;
    
    // UI要素を取得
    const currentDirEl = document.getElementById(`current-direction-${stageNum}`);
    const accuracyEl = document.getElementById(`accuracy-indicator-${stageNum}`);
    const textEl = document.getElementById(`accuracy-text-${stageNum}`);
    
    // 針の更新は updateNeedlePositions() で処理されるため削除
    
    // 現在の方角を表示
    const direction = getDirectionFromHeading(smoothCompassHeading);
    if (currentDirEl) currentDirEl.textContent = direction;
    
    // 目標角度との差を計算
    const difference = Math.abs(getShortestAngleDifference(smoothCompassHeading, target));
    
    if (difference <= tolerance) {
        if (accuracyEl) accuracyEl.classList.add('success');
        if (difference <= 5) {
            const targetName = stageDef.subtitle.match(/(\w+)の方角/)[1];
            if (textEl) textEl.textContent = `完璧！${targetName}を向いています！`;
            
            if (!stageStates.currentCompleteFlag) {
                stageStates.currentCompleteFlag = true;
                setTimeout(() => {
                    stageComplete(`${stageDef.title}クリア！\n${targetName}の方角を見つけました！`);
                }, 2000);
            }
        } else {
            if (textEl) textEl.textContent = '良い感じです！もう少し調整してください。';
        }
    } else {
        if (accuracyEl) accuracyEl.classList.remove('success');
        if (difference <= 20) {
            if (textEl) textEl.textContent = '近づいています！';
        } else {
            if (textEl) textEl.textContent = '方角を調整してください';
        }
    }
}

// 水平ロジック処理
function handleLevelLogic(stageDef) {
    const stageNum = currentStage;
    const tolerance = stageDef.tolerance;
    const requiredTime = stageDef.holdTime;
    
    // UI要素を取得
    const indicatorEl = document.getElementById(`level-indicator-${stageNum}`);
    const timerEl = document.getElementById(`level-timer-${stageNum}`);
    const tiltEl = document.getElementById(`tilt-magnitude-${stageNum}`);
    const progressEl = document.getElementById(`level-progress-${stageNum}`);
    
    const tiltMagnitude = Math.sqrt(smoothTiltX * smoothTiltX + smoothTiltY * smoothTiltY);
    const isLevel = tiltMagnitude <= tolerance;
    
    if (tiltEl) tiltEl.textContent = `傾き: ${Math.round(tiltMagnitude)}°`;
    
    // バブルの位置更新は updateNeedlePositions() で処理されるため削除
    
    if (isLevel && !stageStates.isHolding) {
        stageStates.isHolding = true;
        stageStates.holdStartTime = Date.now();
        if (indicatorEl) indicatorEl.classList.add('success');
    } else if (!isLevel && stageStates.isHolding) {
        stageStates.isHolding = false;
        stageStates.holdTimer = 0;
        if (indicatorEl) indicatorEl.classList.remove('success');
    }
    
    if (stageStates.isHolding) {
        const holdTime = Date.now() - stageStates.holdStartTime;
        const progress = Math.min((holdTime / requiredTime) * 100, 100);
        
        if (timerEl) timerEl.textContent = `${(holdTime / 1000).toFixed(1)}秒維持中`;
        if (progressEl) progressEl.style.width = `${progress}%`;
        
        if (holdTime >= requiredTime && !stageStates.currentCompleteFlag) {
            stageStates.currentCompleteFlag = true;
            stageStates.isHolding = false;
            stageComplete(`${stageDef.title}クリア！\n3秒間水平を維持しました！`);
        }
    } else {
        if (timerEl) timerEl.textContent = '0.0秒維持中';
        if (progressEl) progressEl.style.width = '0%';
    }
}

// シェイクロジック処理
function handleShakeLogic(stageDef) {
    const stageNum = currentStage;
    const requiredShakes = stageDef.requiredShakes;
    
    // UI要素を取得
    const countEl = document.getElementById(`shake-count-${stageNum}`);
    const progressEl = document.getElementById(`shake-progress-${stageNum}`);
    
    if (countEl) {
        countEl.textContent = `${stageStates.shakeCount} / ${requiredShakes}`;
    }
    
    if (progressEl) {
        const progress = Math.min((stageStates.shakeCount / requiredShakes) * 100, 100);
        progressEl.style.width = `${progress}%`;
    }
    
    if (stageStates.shakeCount >= requiredShakes && !stageStates.currentCompleteFlag) {
        stageStates.currentCompleteFlag = true;
        setTimeout(() => {
            stageComplete(`${stageDef.title}クリア！\nシェイクを${requiredShakes}回検出しました！`);
        }, 1000);
    }
}

// 複合ロジック処理
function handleCompoundLogic(stageDef) {
    const stageNum = currentStage;
    const targetDirection = stageDef.targetDirection;
    const directionTolerance = stageDef.directionTolerance;
    const levelTolerance = stageDef.levelTolerance;
    const requiredShakes = stageDef.requiredShakes;
    
    // UI要素を取得
    const directionEl = document.getElementById(`direction-indicator-${stageNum}`);
    const levelEl = document.getElementById(`level-indicator-${stageNum}`);
    const shakeEl = document.getElementById(`shake-indicator-${stageNum}`);
    const statusEl = document.getElementById(`final-status-${stageNum}`);
    
    // 針の更新は updateNeedlePositions() で処理されるため削除
    
    // 条件チェック
    const directionDiff = Math.abs(getShortestAngleDifference(smoothCompassHeading, targetDirection));
    const isFacingTarget = directionDiff <= directionTolerance;
    
    const tiltMagnitude = Math.sqrt(smoothTiltX * smoothTiltX + smoothTiltY * smoothTiltY);
    const isLevel = tiltMagnitude <= levelTolerance;
    
    const hasEnoughShakes = stageStates.shakeCount >= requiredShakes;
    
    // UI更新
    if (directionEl) {
        directionEl.className = 'condition-indicator ' + (isFacingTarget ? 'success' : '');
        directionEl.textContent = `北東向き: ${isFacingTarget ? '✓' : '✗'} (${Math.round(directionDiff)}°差)`;
    }
    
    if (levelEl) {
        levelEl.className = 'condition-indicator ' + (isLevel ? 'success' : '');
        levelEl.textContent = `水平: ${isLevel ? '✓' : '✗'} (${Math.round(tiltMagnitude)}°傾き)`;
    }
    
    if (shakeEl) {
        shakeEl.className = 'condition-indicator ' + (hasEnoughShakes ? 'success' : '');
        shakeEl.textContent = `シェイク: ${stageStates.shakeCount}/${requiredShakes} ${hasEnoughShakes ? '✓' : ''}`;
    }
    
    const allConditionsMet = isFacingTarget && isLevel && hasEnoughShakes;
    
    if (statusEl) {
        if (allConditionsMet) {
            statusEl.textContent = '🎉 全ての条件をクリア！';
            statusEl.className = 'final-status success';
            
            if (!stageStates.currentCompleteFlag) {
                stageStates.currentCompleteFlag = true;
                setTimeout(() => {
                    stageComplete(`${stageDef.title}クリア！\n全ての条件を満たしました！`);
                }, 2000);
            }
        } else {
            statusEl.textContent = '条件を満たしてください';
            statusEl.className = 'final-status';
        }
    }
}

// モールスロジック処理
function handleMorseLogic(stageDef) {
    // モールス信号ステージは主にイベント駆動なので、
    // センサーデータに基づく定期処理は不要
}

// 光センサーロジック処理
function handleLightLogic(stageDef) {
    // 光センサーはカメラベースで独立して動作するため、
    // ここでは特別な処理は不要
}

// バイブレーション機能チェック
function checkVibrationSupport() {
    console.log('=== バイブレーション機能チェック ===');
    console.log('navigator.vibrate存在:', 'vibrate' in navigator);
    console.log('User Agent:', navigator.userAgent);
    console.log('Platform:', navigator.platform);
    console.log('Protocol:', location.protocol);
    
    // 複数の方法でバイブレーション機能をチェック
    const hasVibrate = 'vibrate' in navigator;
    const hasWebkitVibrate = 'webkitVibrate' in navigator;
    const hasMozVibrate = 'mozVibrate' in navigator;
    
    console.log('navigator.vibrate:', hasVibrate);
    console.log('navigator.webkitVibrate:', hasWebkitVibrate);
    console.log('navigator.mozVibrate:', hasMozVibrate);
    
    if (!hasVibrate && !hasWebkitVibrate && !hasMozVibrate) {
        console.warn('❌ バイブレーション機能はサポートされていません');
        return false;
    }
    
    // テストバイブレーション
    try {
        const testResult = navigator.vibrate(100);
        console.log('テストバイブレーション結果:', testResult);
        console.log('✅ バイブレーション機能が利用可能です');
        return true;
    } catch (error) {
        console.error('❌ バイブレーションテストエラー:', error);
        return false;
    }
}

// 視覚的フィードバック要素を更新
function updateVisualFeedback(type, letter = '') {
    const morseVisual = document.getElementById('morse-visual');
    if (!morseVisual) return;
    
    switch (type) {
        case 'dot':
            morseVisual.textContent = '●';
            morseVisual.className = 'morse-visual active dot';
            break;
        case 'dash':
            morseVisual.textContent = '━';
            morseVisual.className = 'morse-visual active dash';
            break;
        case 'letter':
            morseVisual.textContent = letter;
            morseVisual.className = 'morse-visual letter';
            break;
        case 'pause':
            morseVisual.textContent = '・';
            morseVisual.className = 'morse-visual pause';
            break;
        case 'clear':
        default:
            morseVisual.textContent = '';
            morseVisual.className = 'morse-visual';
    }
}

// 改良されたモールス信号再生機能
async function playMorseVibration(word, stageNum = 6) {
    console.log('🎵 モールス信号再生開始:', word);
    
    if (!checkVibrationSupport()) {
        console.warn('⚠️ バイブレーション非対応 - 視覚的再生のみ');
        await playMorseVisualOnly(word);
        return;
    }
    
    if (isPlayingMorse) {
        console.log('⏸️ 既に再生中のため停止');
        return;
    }
    
    isPlayingMorse = true;
    currentMorseWord = word;
    
    // UI更新
    const morseStatus = document.getElementById('morse-status');
    const playButton = document.getElementById('play-morse-btn');
    
    if (morseStatus) morseStatus.textContent = `🎵 再生中: ${word}`;
    if (playButton) {
        playButton.disabled = true;
        playButton.textContent = '再生中...';
    }
    
    try {
        // 単語全体のバイブレーションパターンを生成
        const vibrationPattern = [];
        const visualPattern = [];
        
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const pattern = morsePatterns[letter];
            
            if (pattern) {
                console.log(`文字 "${letter}": ${pattern}`);
                
                for (let j = 0; j < pattern.length; j++) {
                    const signal = pattern[j];
                    
                    if (signal === '.') {
                        vibrationPattern.push(VIBRATION_SHORT, VIBRATION_PAUSE);
                        visualPattern.push({type: 'dot', duration: VIBRATION_SHORT + VIBRATION_PAUSE});
                    } else if (signal === '-') {
                        vibrationPattern.push(VIBRATION_LONG, VIBRATION_PAUSE);
                        visualPattern.push({type: 'dash', duration: VIBRATION_LONG + VIBRATION_PAUSE});
                    }
                }
                
                // 文字間の休止（最後の文字以外）
                if (i < word.length - 1) {
                    vibrationPattern.push(VIBRATION_LETTER_PAUSE);
                    visualPattern.push({type: 'letter', letter: letter, duration: VIBRATION_LETTER_PAUSE});
                }
            }
        }
        
        console.log('バイブレーションパターン:', vibrationPattern);
        
        // パターン全体を一度に再生（より確実）
        const vibrationResult = performVibration(vibrationPattern);
        console.log('一括バイブレーション結果:', vibrationResult);
        
        // 視覚的フィードバックを並行して実行
        playVisualPattern(visualPattern);
        
        // 再生時間を計算
        const totalDuration = vibrationPattern.reduce((sum, duration) => sum + duration, 0);
        await sleep(totalDuration + 500); // 少し余裕を持たせる
        
    } catch (error) {
        console.error('❌ モールス信号再生エラー:', error);
        // エラー時は視覚的再生のみ
        await playMorseVisualOnly(word);
    }
    
    isPlayingMorse = false;
    
    // UI更新
    if (morseStatus) morseStatus.textContent = `✅ 再生完了！ "${word}" を入力してください`;
    if (playButton) {
        playButton.disabled = false;
        playButton.textContent = '📳 モールス信号を再生';
    }
    updateVisualFeedback('clear');
    
    console.log('✅ モールス信号再生完了');
}

// バイブレーション非対応時の視覚的再生
async function playMorseVisualOnly(word) {
    console.log('👁️ 視覚的モールス信号再生:', word);
    
    const morseStatus = document.getElementById('morse-status');
    if (morseStatus) morseStatus.textContent = `👁️ 視覚再生中: ${word}`;
    
    for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const pattern = morsePatterns[letter];
        
        if (pattern) {
            for (let j = 0; j < pattern.length; j++) {
                const signal = pattern[j];
                
                if (signal === '.') {
                    updateVisualFeedback('dot');
                    await sleep(VIBRATION_SHORT);
                } else if (signal === '-') {
                    updateVisualFeedback('dash');
                    await sleep(VIBRATION_LONG);
                }
                
                updateVisualFeedback('pause');
                await sleep(VIBRATION_PAUSE);
            }
            
            updateVisualFeedback('letter', letter);
            await sleep(VIBRATION_LETTER_PAUSE);
        }
    }
}

// 視覚的パターン再生
async function playVisualPattern(pattern) {
    for (const item of pattern) {
        updateVisualFeedback(item.type, item.letter);
        await sleep(item.duration);
    }
}

// スリープ関数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 新しいモールス信号の単語を選択
function generateNewMorseWord() {
    const randomIndex = Math.floor(Math.random() * morseWords.length);
    return morseWords[randomIndex];
}

// プレイヤーの入力をチェック
function checkMorseInput(stageNum = 6) {
    const inputElement = document.getElementById(`morse-input-${stageNum}`);
    const hintElement = document.getElementById(`morse-hint-${stageNum}`);
    
    if (!inputElement) {
        console.error(`❌ morse-input-${stageNum} が見つかりません`);
        return;
    }
    
    const input = inputElement.value.toUpperCase().trim();
    const targetWord = stageStates.currentWord || currentMorseWord;
    
    console.log('📝 入力チェック:', input, 'vs', targetWord);
    
    if (input === targetWord) {
        // 正解
        inputElement.style.borderColor = '#ffffff';
        inputElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        if (hintElement) {
            hintElement.textContent = '🎉 正解！素晴らしい！';
            hintElement.style.color = '#ffffff';
        }
        
        // 正解時のバイブレーション
        if (checkVibrationSupport()) {
            performVibration([100, 100, 100, 100, 100]); // 成功パターン
        }
        
        setTimeout(() => {
            stageComplete(`ステージ${stageNum}クリア！\nモールス信号を解読できました！\n🎊 おめでとうございます！`);
        }, 1500);
    } else if (input.length > 0) {
        // 入力中の判定
        if (targetWord.startsWith(input)) {
            // 部分一致
            inputElement.style.borderColor = '#999999';
            inputElement.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            if (hintElement) {
                hintElement.textContent = `👍 良い感じです！続けてください... (${input.length}/${targetWord.length}文字)`;
                hintElement.style.color = '#999999';
            }
        } else {
            // 不一致
            inputElement.style.borderColor = '#ff6b6b';
            inputElement.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
            if (hintElement) {
                hintElement.textContent = `❌ 違います。目標: ${targetWord.length}文字の英単語`;
                hintElement.style.color = '#ff6b6b';
            }
        }
    } else {
        // 空の入力
        inputElement.style.borderColor = '#333333';
        inputElement.style.backgroundColor = 'transparent';
        if (hintElement) {
            hintElement.textContent = `💡 ヒント: ${targetWord.length}文字の英単語です`;
            hintElement.style.color = '#666666';
        }
    }
}

// モールス入力のリアルタイムヒント更新
function updateMorseHint(stageNum) {
    const inputElement = document.getElementById(`morse-input-${stageNum}`);
    const hintElement = document.getElementById(`morse-hint-${stageNum}`);
    
    if (!inputElement || !hintElement) return;
    
    const input = inputElement.value.toUpperCase().trim();
    const targetWord = stageStates.currentWord || currentMorseWord;
    
    if (input.length === 0) {
        hintElement.textContent = `💡 ヒント: ${targetWord.length}文字の英単語です`;
        hintElement.style.color = '#666666';
        inputElement.style.borderColor = '#333333';
        return;
    }
    
    if (targetWord.startsWith(input)) {
        // 部分一致
        inputElement.style.borderColor = '#999999';
        hintElement.textContent = `👍 良い感じです！ (${input.length}/${targetWord.length}文字)`;
        hintElement.style.color = '#999999';
    } else {
        // 不一致
        inputElement.style.borderColor = '#ff6b6b';
        hintElement.textContent = `❌ 違います。目標: ${targetWord.length}文字の英単語`;
        hintElement.style.color = '#ff6b6b';
    }
}

// 角度から方角を取得
function getDirectionFromHeading(heading) {
    const directions = [
        { name: '北', min: 0, max: 22.5 },
        { name: '北北東', min: 22.5, max: 67.5 },
        { name: '東北', min: 337.5, max: 360 }, // 北の続き
        { name: '東北', min: 22.5, max: 67.5 },
        { name: '東', min: 67.5, max: 112.5 },
        { name: '南東', min: 112.5, max: 157.5 },
        { name: '南', min: 157.5, max: 202.5 },
        { name: '南西', min: 202.5, max: 247.5 },
        { name: '西', min: 247.5, max: 292.5 },
        { name: '北西', min: 292.5, max: 337.5 }
    ];
    
    // 簡易版の方角判定
    if (heading >= 337.5 || heading < 22.5) return '北';
    if (heading >= 22.5 && heading < 67.5) return '東北';
    if (heading >= 67.5 && heading < 112.5) return '東';
    if (heading >= 112.5 && heading < 157.5) return '南東';
    if (heading >= 157.5 && heading < 202.5) return '南';
    if (heading >= 202.5 && heading < 247.5) return '南西';
    if (heading >= 247.5 && heading < 292.5) return '西';
    if (heading >= 292.5 && heading < 337.5) return '北西';
    
    return '不明';
}

// ステージクリア
function stageComplete(message) {
    console.log(`🎉 ステージ${currentStage}クリア:`, message);
    console.log(`📊 現在の状態: currentStage=${currentStage}, TOTAL_STAGES=${TOTAL_STAGES}`);
    
    // 成功メッセージ要素を取得（グローバル変数が失効している場合の対策）
    const successMessageEl = successMessage || document.getElementById('success-message');
    const successModalEl = successModal || document.getElementById('success-modal');
    
    if (successMessageEl) {
        successMessageEl.textContent = message;
        console.log('✅ 成功メッセージを設定しました');
    } else {
        console.error('❌ success-message要素が見つかりません');
    }
    
    if (successModalEl) {
        successModalEl.classList.add('active');
        console.log('✅ 成功モーダルを表示しました');
        console.log('👆 「次のステージへ」ボタンを押してください');
    } else {
        console.error('❌ success-modal要素が見つかりません');
        // フォールバック: アラートで表示
        alert(message);
    }
}

// 次のステージへ進む
function goToNextStage() {
    console.log('🎯 次のステージへ進みます');
    
    // 成功モーダルを閉じる
    const successModalEl = successModal || document.getElementById('success-modal');
    if (successModalEl) {
        successModalEl.classList.remove('active');
    }
    
    // 現在のステージを非表示
    const currentStageEl = document.getElementById(`stage-${currentStage}`);
    if (currentStageEl) {
        currentStageEl.classList.remove('active');
    }
    
    // 次のステージへ
    currentStage++;
    console.log(`🎯 ステージ切り替え: ${currentStage - 1} → ${currentStage}`);
    
    // ステージ6まで実装済み（ステージ0〜6の7ステージ）
    if (currentStage >= TOTAL_STAGES) {
        console.log('🎉 全ステージクリア！ゲームを完了します');
        alert('🎉 すべてのステージをクリアしました！\nお疲れ様でした！');
        currentStage = 0; // リセット
        console.log('🔄 ステージ0にリセットしました');
    } else {
        console.log(`✅ ステージ${currentStage}に進みます`);
    }
    
    // 新しいステージを表示
    const nextStageEl = document.getElementById(`stage-${currentStage}`);
    if (nextStageEl) {
        nextStageEl.classList.add('active');
        console.log(`✅ ステージ${currentStage}の要素を表示しました`);
    } else {
        console.error(`❌ stage-${currentStage}の要素が見つかりません`);
    }
    
    // ステージ情報更新
    updateStageDisplay();
    
    // ステージ状態リセット
    resetStageState();
    
    // デバッグパネル更新
    if (debugMode) {
        updateDebugPanel();
    }
}

// ステージ表示更新
function updateStageDisplay() {
    const stageInfoEl = stageInfo || document.getElementById('current-stage');
    if (stageInfoEl) {
        stageInfoEl.textContent = `ステージ ${currentStage}`;
        console.log(`📊 ステージ表示を更新: ステージ ${currentStage}`);
    } else {
        console.error('❌ current-stage要素が見つかりません');
    }
    
    // ステージ選択ボタンの状態も更新
    updateStageButtons();
}

// ステージ選択ボタンの状態更新
function updateStageButtons() {
    for (let i = 0; i <= 7; i++) {
        const btn = document.getElementById(`stage-btn-${i}`);
        if (btn) {
            // 全てのクラスをリセット
            btn.classList.remove('active', 'completed');
            
            if (i === currentStage) {
                // 現在のステージをアクティブに
                btn.classList.add('active');
            } else if (i < currentStage) {
                // クリア済みステージを完了済みに
                btn.classList.add('completed');
            }
        }
    }
}

// 初期ステージ表示設定
function initializeStageDisplay() {
    console.log('🎯 初期ステージ表示を設定中...');
    
    // すべてのステージを非表示にする
    for (let i = 0; i < TOTAL_STAGES; i++) {
        const stageEl = document.getElementById(`stage-${i}`);
        if (stageEl) {
            stageEl.classList.remove('active');
        }
    }
    
    // 現在のステージ（初期値はステージ0）を表示
    const currentStageEl = document.getElementById(`stage-${currentStage}`);
    if (currentStageEl) {
        currentStageEl.classList.add('active');
        console.log(`✅ ステージ${currentStage}を表示しました`);
    } else {
        console.error(`❌ ステージ${currentStage}の要素が見つかりません`);
    }
    
    // ステージ状態をリセット
    resetStageState();
}

// センサー許可状況をチェック
function checkSensorPermissionStatus() {
    console.log('🔍 センサー許可状況をチェック中...');
    
    // センサーがすでに許可されているかチェック
    if (permissionGranted) {
        console.log('✅ センサー許可済み');
        // 許可モーダルを非表示
        if (permissionModal) {
            permissionModal.classList.remove('active');
        }
        return;
    }
    
    // iOS 13+のデバイスかチェック
    const isIOS13Plus = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       'DeviceOrientationEvent' in window && 
                       typeof DeviceOrientationEvent.requestPermission === 'function';
    
    // HTTPS接続でない場合の警告
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('⚠️ HTTPS接続でないため、センサーアクセスが制限される可能性があります');
    }
    
    // 許可モーダルを表示
    if (permissionModal) {
        permissionModal.classList.add('active');
        console.log('📱 センサー許可モーダルを表示しました');
    } else {
        console.error('❌ 許可モーダル要素が見つかりません');
    }
}

// ステージ状態リセット（新システム対応）
function resetStageState() {
    console.log(`🔄 ステージ${currentStage}の状態をリセット中...`);
    
    // 共通状態リセット
    stageStates.currentCompleteFlag = false;
    stageStates.isHolding = false;
    stageStates.holdStartTime = 0;
    
    // ステージタイプ別のリセット
    const stageDef = STAGE_DEFINITIONS[currentStage];
    if (stageDef) {
        switch (stageDef.type) {
            case 'shake':
            case 'compound':
                // シェイクステージまたは複合ステージでシェイクカウントをリセット
                stageStates.shakeCount = 0;
                shakeDetected = false;
                console.log(`🔄 ${stageDef.type}ステージ: シェイクカウントをリセット`);
                break;
                
            case 'morse':
                // モールス信号ステージのリセット
                isPlayingMorse = false;
                stageStates.currentWord = generateNewMorseWord();
                console.log('🔄 モールス信号の新しい単語:', stageStates.currentWord);
                
                const morseInput = document.getElementById(`morse-input-${currentStage}`);
                const morseHint = document.getElementById(`morse-hint-${currentStage}`);
                const morseStatus = document.getElementById(`morse-status-${currentStage}`);
                
                if (morseInput) {
                    morseInput.value = '';
                    morseInput.style.borderColor = '#333333';
                }
                if (morseHint) morseHint.textContent = '';
                if (morseStatus) morseStatus.textContent = '新しいモールス信号を再生する準備ができました';
                break;
                
            case 'light':
                // 光センサーステージのリセット
                stageStates.lightLevels = [];
                stopLightSensor(); // カメラを停止
                console.log('🔄 光センサーステージをリセット');
                break;
        }
    }
    
    console.log(`✅ ステージ${currentStage}の状態リセット完了`);
}

// デバッグ用: センサーサポート確認
function checkSensorSupport() {
    console.log('=== センサーサポート状況 ===');
    console.log('DeviceOrientationEvent supported:', 'DeviceOrientationEvent' in window);
    console.log('DeviceMotionEvent supported:', 'DeviceMotionEvent' in window);
    console.log('Permission API supported:', typeof DeviceOrientationEvent.requestPermission === 'function');
    console.log('User Agent:', navigator.userAgent);
    console.log('Protocol:', location.protocol);
    console.log('Hostname:', location.hostname);
    console.log('Is HTTPS or localhost:', location.protocol === 'https:' || location.hostname === 'localhost');
    
    // ブラウザ判定
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    console.log('iOS:', isIOS);
    console.log('Android:', isAndroid);
    console.log('Safari:', isSafari);
    console.log('==================');
}

// エラーハンドリング
window.addEventListener('error', function(event) {
    console.error('ゲームエラー:', event.error);
});

// ページ読み込み完了時にセンサーサポートをチェック
window.addEventListener('load', function() {
    console.log('🌟 ページ読み込み完了');
    checkSensorSupport();
    
    // デバッグ情報を画面に表示（開発用）
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
    debugInfo.style.cssText = `
        position: fixed; 
        top: 0; 
        right: 0; 
        background: rgba(0,0,0,0.8); 
        color: white; 
        padding: 10px; 
        font-size: 12px; 
        z-index: 9999;
        max-width: 300px;
        word-wrap: break-word;
    `;
    debugInfo.innerHTML = `
        <div>🔧 Debug Info</div>
        <div>Agent: ${navigator.userAgent.substring(0, 30)}...</div>
        <div>Protocol: ${location.protocol}</div>
        <div>DeviceOrientation: ${'DeviceOrientationEvent' in window}</div>
    `;
    document.body.appendChild(debugInfo);
    
    // 5秒後にデバッグ情報を隠す
    setTimeout(() => {
        if (debugInfo) debugInfo.style.display = 'none';
    }, 10000);
});

// ==================== デバッグモード機能 ====================

// デバッグモードの切り替え
function toggleDebugMode() {
    debugMode = !debugMode;
    localStorage.setItem('nazoGameDebugMode', debugMode.toString());
    console.log('🐛 デバッグモード:', debugMode ? 'ON' : 'OFF');
    
    if (debugMode) {
        showDebugPanel();
        console.log('🎮 デバッグコマンド:');
        console.log('  - goToStage(n): ステージnに移動');
        console.log('  - toggleDebugMode(): デバッグモード切り替え');
        console.log('  - resetGame(): ゲームリセット');
    } else {
        hideDebugPanel();
    }
}

// 特定のステージに移動
function goToStage(stageNumber) {
    if (stageNumber < 0 || stageNumber >= TOTAL_STAGES) {
        console.error('❌ 無効なステージ番号:', stageNumber);
        return;
    }
    
    console.log(`🎯 ステージ${stageNumber}に移動`);
    
    // 現在のステージを非表示
    const currentStageEl = document.getElementById(`stage-${currentStage}`);
    if (currentStageEl) {
        currentStageEl.classList.remove('active');
    }
    
    // 新しいステージに移動
    currentStage = stageNumber;
    
    // 新しいステージを表示
    const newStageEl = document.getElementById(`stage-${currentStage}`);
    if (newStageEl) {
        newStageEl.classList.add('active');
    }
    
    // ステージ情報更新
    updateStageDisplay();
    
    // ステージ状態リセット
    resetStageState();
    
    // デバッグパネルの現在ステージ表示を更新
    if (debugMode) {
        updateDebugPanel();
    }
}

// デバッグパネルの表示
function showDebugPanel() {
    // 既存のパネルを削除
    hideDebugPanel();
    
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.innerHTML = `
        <div class="debug-header">
            🐛 デバッグパネル
            <button id="debug-close" style="float: right; background: none; border: none; color: white; cursor: pointer;">✕</button>
        </div>
        <div class="debug-content">
            <div class="debug-stage-info">
                現在: ステージ <span id="debug-current-stage">${currentStage}</span>
            </div>
            <div class="debug-stage-buttons">
                ${Array.from({length: TOTAL_STAGES}, (_, i) => 
                    `<button class="debug-stage-btn" onclick="goToStage(${i})" ${i === currentStage ? 'disabled' : ''}>
                        ステージ${i}
                    </button>`
                ).join('')}
            </div>
            <div class="debug-actions">
                <button onclick="resetGame()">🔄 リセット</button>
                <button onclick="stageComplete('デバッグクリア')">✅ 強制クリア</button>
            </div>
            <div class="debug-info">
                <small>
                    キーボード: D+E+B+U+G でも切り替え可能<br>
                    コンソール: goToStage(n), toggleDebugMode()
                </small>
            </div>
        </div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // 閉じるボタンのイベント
    document.getElementById('debug-close').addEventListener('click', () => {
        toggleDebugMode();
    });
}

// デバッグパネルの非表示
function hideDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (panel) {
        panel.remove();
    }
}

// デバッグパネルの更新
function updateDebugPanel() {
    if (!debugMode) return;
    
    const debugPanel = document.getElementById('debug-panel');
    if (!debugPanel) return;
    
    // 現在のステージ情報を更新
    const currentStageSpan = document.getElementById('debug-current-stage');
    if (currentStageSpan) {
        currentStageSpan.textContent = currentStage;
    }
    
    // ボタンの状態更新
    const buttons = document.querySelectorAll('.debug-stage-btn');
    buttons.forEach((btn, index) => {
        btn.disabled = (index === currentStage);
    });
    
    // 詳細情報の更新
    const debugContent = debugPanel.querySelector('.debug-content');
    if (!debugContent) return;
    
    // 現在のステージ定義を取得
    const stageDef = STAGE_DEFINITIONS[currentStage];
    
    // 詳細情報エリアを探すか作成
    let infoEl = debugContent.querySelector('.debug-info');
    if (!infoEl) {
        infoEl = document.createElement('div');
        infoEl.className = 'debug-info';
        debugContent.appendChild(infoEl);
    }
    
    let stageSpecificInfo = '';
    
    if (stageDef) {
        switch (stageDef.type) {
            case 'compass':
                const angleDiff = Math.abs(getShortestAngleDifference(smoothCompassHeading, stageDef.target));
                stageSpecificInfo = `
                    <br>コンパス情報:<br>
                    • 目標: ${stageDef.target}° 許容: ±${stageDef.tolerance}°<br>
                    • 角度差: ${Math.round(angleDiff)}° 範囲内: ${angleDiff <= stageDef.tolerance ? '✅' : '❌'}<br>
                    • 保持中: ${stageStates.isHolding ? '✅' : '❌'}
                `;
                break;
            case 'shake':
            case 'compound':
                stageSpecificInfo = `
                    <br>シェイク情報:<br>
                    • カウント: ${stageStates.shakeCount}<br>
                    • 必要数: ${stageDef.requiredShakes || 'N/A'}
                `;
                break;
            case 'level':
                const tiltMagnitude = Math.sqrt(smoothTiltX * smoothTiltX + smoothTiltY * smoothTiltY);
                stageSpecificInfo = `
                    <br>水平情報:<br>
                    • 傾き量: ${Math.round(tiltMagnitude)}° 許容: ${stageDef.tolerance}°<br>
                    • 水平: ${tiltMagnitude <= stageDef.tolerance ? '✅' : '❌'}
                `;
                break;
        }
    }
    
    infoEl.innerHTML = `
        <small>
            センサー値:<br>
            • コンパス: ${Math.round(smoothCompassHeading)}° (${Math.round(compassHeading)}°)<br>
            • 傾きX: ${Math.round(smoothTiltX)}° (${Math.round(tiltX)}°)<br>
            • 傾きY: ${Math.round(smoothTiltY)}° (${Math.round(tiltY)}°)<br>
            状態: ${permissionGranted ? '許可済み' : '未許可'} | ${animationFrameId ? 'アニメ中' : '停止中'}<br>
            クリア済み: ${stageStates.currentCompleteFlag ? '✅' : '❌'}
            ${stageSpecificInfo}
        </small>
    `;
}

// ゲームリセット
function resetGame() {
    console.log('🔄 ゲームをリセット');
    
    // 現在のステージを非表示
    const currentStageEl = document.getElementById(`stage-${currentStage}`);
    if (currentStageEl) {
        currentStageEl.classList.remove('active');
    }
    
    // ステージ0に移動
    currentStage = 0;
    
    // ステージ0を表示
    const stage0El = document.getElementById(`stage-${currentStage}`);
    if (stage0El) {
        stage0El.classList.add('active');
    }
    
    // ステージ情報更新
    updateStageDisplay();
    
    // ステージ状態リセット
    resetStageState();
    
    // デバッグパネル更新
    if (debugMode) {
        updateDebugPanel();
    }
}

// キーボードショートカット処理
document.addEventListener('keydown', (event) => {
    // デバッグキーシーケンス: D-E-B-U-G
    const key = event.key.toLowerCase();
    debugKeySequence += key;
    
    // シーケンスが長すぎる場合はリセット
    if (debugKeySequence.length > DEBUG_KEY_CODE.length) {
        debugKeySequence = key;
    }
    
    // デバッグコードが入力された場合
    if (debugKeySequence === DEBUG_KEY_CODE) {
        toggleDebugMode();
        debugKeySequence = '';
    }
    
    // テストモードコード: T-E-S-T
    if (debugKeySequence === 'test') {
        startTestMode();
        debugKeySequence = '';
    }
    
    // 1秒後にシーケンスをリセット
    setTimeout(() => {
        debugKeySequence = '';
    }, 1000);
    
    // デバッグモード時のホットキー
    if (debugMode) {
        // Ctrl+数字でステージ移動
        if (event.ctrlKey && event.key >= '0' && event.key <= '6') {
            event.preventDefault();
            const stageNum = parseInt(event.key);
            goToStage(stageNum);
        }
        
        // Escapeでデバッグモード終了
        if (event.key === 'Escape') {
            toggleDebugMode();
        }
    }
});

// ページ読み込み時にデバッグモードを復元
document.addEventListener('DOMContentLoaded', () => {
    if (debugMode) {
        console.log('🐛 デバッグモードが有効です');
        setTimeout(() => {
            showDebugPanel();
        }, 1000);
    }
    
    // グローバル関数として公開（コンソールから使用可能）
    window.goToStage = goToStage;
    window.toggleDebugMode = toggleDebugMode;
    window.resetGame = resetGame;
    
    console.log('🎮 ゲーム制御関数が利用可能です:');
    console.log('  - goToStage(n): ステージnに移動');
    console.log('  - toggleDebugMode(): デバッグモード切り替え（またはD+E+B+U+Gキー）');
    console.log('  - resetGame(): ゲームリセット');
});

// ==================== 光センサー関数群 ====================

let lightSensorActive = false;
let lightSensorStream = null;
let lightStep = 1; // 1: 明るい場所, 2: 暗い場所, 3: 明るい場所
let lightStepStartTime = 0;

// 光センサー開始
async function startLightSensor() {
    console.log('📷 光センサーを開始します');
    
    try {
        const constraints = {
            video: {
                facingMode: 'environment', // 背面カメラを優先
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        lightSensorStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const video = document.getElementById(`light-camera-${currentStage}`);
        const startBtn = document.getElementById(`start-camera-btn-${currentStage}`);
        const stopBtn = document.getElementById(`stop-camera-btn-${currentStage}`);
        const statusEl = document.getElementById(`light-status-${currentStage}`);
        
        if (video && lightSensorStream) {
            video.srcObject = lightSensorStream;
            lightSensorActive = true;
            lightStep = 1;
            lightStepStartTime = Date.now();
            
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'inline-block';
            if (statusEl) statusEl.textContent = '明るい場所に移動してください（3秒間）';
            
            // 明るさ検出ループを開始
            detectLightLevel();
            
            console.log('✅ 光センサーが開始されました');
        }
    } catch (error) {
        console.error('❌ カメラアクセスエラー:', error);
        
        const statusEl = document.getElementById(`light-status-${currentStage}`);
        if (statusEl) {
            statusEl.textContent = 'カメラアクセスに失敗しました。カメラの許可を確認してください。';
            statusEl.style.color = '#ff6b6b';
        }
        
        alert('カメラアクセスに失敗しました。\nカメラの許可を確認してから再試行してください。');
    }
}

// 光センサー停止
function stopLightSensor() {
    console.log('⏹️ 光センサーを停止します');
    
    lightSensorActive = false;
    
    if (lightSensorStream) {
        lightSensorStream.getTracks().forEach(track => track.stop());
        lightSensorStream = null;
    }
    
    const startBtn = document.getElementById(`start-camera-btn-${currentStage}`);
    const stopBtn = document.getElementById(`stop-camera-btn-${currentStage}`);
    const statusEl = document.getElementById(`light-status-${currentStage}`);
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
    if (statusEl) {
        statusEl.textContent = 'カメラを開始して光センサーチャレンジを始めてください';
        statusEl.style.color = '';
    }
    
    // プログレスバーをリセット
    for (let i = 1; i <= 3; i++) {
        const progressEl = document.getElementById(`light-progress-${i}-${currentStage}`);
        if (progressEl) {
            // プログレス内部の進捗バーをリセット
            const innerBar = progressEl.querySelector('.progress-fill');
            if (innerBar) innerBar.style.width = '0%';
        }
    }
    
    console.log('✅ 光センサーが停止されました');
}

// 明るさレベル検出
function detectLightLevel() {
    if (!lightSensorActive) return;
    
    const video = document.getElementById(`light-camera-${currentStage}`);
    const canvas = document.getElementById(`light-canvas-${currentStage}`);
    
    if (!video || !canvas) {
        console.error('❌ ビデオまたはキャンバス要素が見つかりません');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    canvas.width = 160; // 小さいサイズで処理速度向上
    canvas.height = 120;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // 平均明度を計算
    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // 明度計算（RGB to YUV変換の Y値）
        brightness += (0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    brightness = brightness / (canvas.width * canvas.height);
    
    // UI更新
    const lightCircle = document.getElementById(`light-circle-${currentStage}`);
    const lightValue = document.getElementById(`light-value-${currentStage}`);
    const lightIndicator = document.getElementById(`light-level-indicator-${currentStage}`);
    
    if (lightValue) {
        lightValue.textContent = `明度: ${Math.round(brightness)}`;
    }
    
    if (lightIndicator) {
        const percentage = Math.min(100, brightness / 255 * 100);
        lightIndicator.style.height = `${percentage}%`;
        lightIndicator.style.backgroundColor = brightness > 127 ? '#ffd700' : '#4a4a4a';
    }
    
    if (lightCircle) {
        lightCircle.style.background = `radial-gradient(circle, rgba(255,255,255,${brightness/255}) 0%, rgba(0,0,0,0.8) 100%)`;
    }
    
    // ステップ処理
    processLightStep(brightness);
    
    // 次のフレーム
    if (lightSensorActive) {
        requestAnimationFrame(detectLightLevel);
    }
}

// 光センサーステップ処理
function processLightStep(brightness) {
    const currentTime = Date.now();
    const stepDuration = 3000; // 3秒
    const timeElapsed = currentTime - lightStepStartTime;
    
    const statusEl = document.getElementById(`light-status-${currentStage}`);
    const progressEl = document.getElementById(`light-progress-${lightStep}-${currentStage}`);
    
    let isCorrectCondition = false;
    let stepName = '';
    
    // ステップ条件チェック
    switch (lightStep) {
        case 1: // 明るい場所
            isCorrectCondition = brightness > 150;
            stepName = '明るい場所';
            break;
        case 2: // 暗い場所
            isCorrectCondition = brightness < 80;
            stepName = '暗い場所';
            break;
        case 3: // 再び明るい場所
            isCorrectCondition = brightness > 150;
            stepName = '明るい場所';
            break;
    }
    
    if (isCorrectCondition) {
        // 正しい条件を満たしている
        const progress = Math.min(100, (timeElapsed / stepDuration) * 100);
        
        if (progressEl) {
            // プログレス内部の進捗バーを更新
            const innerBar = progressEl.querySelector('.progress-fill');
            if (innerBar) {
                innerBar.style.width = `${progress}%`;
            }
        }
        
        if (statusEl) {
            const remaining = Math.max(0, (stepDuration - timeElapsed) / 1000);
            statusEl.textContent = `${stepName}で維持中... 残り${remaining.toFixed(1)}秒`;
            statusEl.style.color = '#4CAF50';
        }
        
        // ステップ完了チェック
        if (timeElapsed >= stepDuration) {
            lightStep++;
            lightStepStartTime = currentTime;
            
            if (lightStep > 3) {
                // 全ステップ完了
                lightSensorComplete();
            } else {
                // 次のステップへ
                const nextStepName = lightStep === 2 ? '暗い場所' : '明るい場所';
                if (statusEl) {
                    statusEl.textContent = `ステップ${lightStep-1}完了！次は${nextStepName}に移動してください`;
                    statusEl.style.color = '#2196F3';
                }
            }
        }
    } else {
        // 条件を満たしていない
        lightStepStartTime = currentTime; // タイマーリセット
        
        if (progressEl) {
            // プログレス内部の進捗バーをリセット
            const innerBar = progressEl.querySelector('.progress-fill');
            if (innerBar) {
                innerBar.style.width = '0%';
            }
        }
        
        if (statusEl) {
            statusEl.textContent = `${stepName}に移動してください（現在の明度: ${Math.round(brightness)}）`;
            statusEl.style.color = '#ff9800';
        }
    }
}

// 光センサーチャレンジ完了
function lightSensorComplete() {
    console.log('🎉 光センサーチャレンジ完了！');
    
    stopLightSensor();
    
    const statusEl = document.getElementById(`light-status-${currentStage}`);
    if (statusEl) {
        statusEl.textContent = '🎉 光センサーチャレンジ完了！';
        statusEl.style.color = '#4CAF50';
    }
    
    setTimeout(() => {
        stageComplete('ステージ7クリア！\n光センサーチャレンジを完了しました！');
    }, 2000);
}

// ==================== テストモード機能 ====================

// テストモード（各ステージの自動クリア機能）
function startTestMode() {
    console.log('🧪 テストモード開始');
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 255, 255, 0.95); color: black; padding: 20px;
        border-radius: 10px; z-index: 10000; font-size: 14px; text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); border: 2px solid #00cccc;
    `;
    modal.innerHTML = `
        <h3>🧪 テストモード</h3>
        <p>デバッグ用：ステージのクリア機能</p>
        <button id="test-auto-clear" style="margin: 5px; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer;">現在のステージをクリア</button><br>
        <button id="test-all-stages" style="margin: 5px; padding: 10px; background: #4ecdc4; color: white; border: none; border-radius: 5px; cursor: pointer;">全ステージ順次クリア</button><br>
        <button id="test-reset" style="margin: 5px; padding: 10px; background: #45b7d1; color: white; border: none; border-radius: 5px; cursor: pointer;">ゲームリセット</button><br>
        <button id="test-close" style="margin: 5px; padding: 10px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">閉じる</button>
    `;
    document.body.appendChild(modal);
    
    // ボタンイベント
    document.getElementById('test-auto-clear').onclick = () => {
        if (currentStage === 0) {
            goToNextStage();
        } else {
            stageStates.currentCompleteFlag = true;
            stageComplete(`テストモード: ステージ${currentStage}を強制クリア`);
        }
        modal.remove();
    };
    
    document.getElementById('test-all-stages').onclick = () => {
        modal.remove();
        let testStage = 1;
        const testInterval = setInterval(() => {
            if (testStage > TOTAL_STAGES - 1) {
                clearInterval(testInterval);
                console.log('🧪 全ステージテスト完了');
                alert('🎉 全ステージテスト完了！');
                return;
            }
            
            console.log(`🧪 ステージ${testStage}をテスト中...`);
            goToStage(testStage);
            
            setTimeout(() => {
                stageStates.currentCompleteFlag = true;
                stageComplete(`テストモード: ステージ${testStage}を自動クリア`);
                
                setTimeout(() => {
                    const nextBtn = document.getElementById('next-stage-btn');
                    if (nextBtn) {
                        nextBtn.click();
                    } else {
                        goToNextStage();
                    }
                }, 1000);
            }, 500);
            
            testStage++;
        }, 3000);
    };
    
    document.getElementById('test-reset').onclick = () => {
        resetGame();
        modal.remove();
    };
    
    document.getElementById('test-close').onclick = () => modal.remove();
}

