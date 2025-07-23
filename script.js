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
const TOTAL_STAGES = 7; // ステージ0〜6

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
        
        console.log('🔧 DOM要素を再取得しました');
        return true;
    } catch (error) {
        console.error('❌ DOM要素取得エラー:', error);
        return false;
    }
}

// センサー値表示要素
const compassValueEl = document.getElementById('compass-value');
const tiltXEl = document.getElementById('tilt-x');
const tiltYEl = document.getElementById('tilt-y');

// ステージ1要素
const compassDisplay = document.getElementById('compass-display');
const compassNeedle = document.getElementById('compass-needle');
const holdProgress = document.getElementById('hold-progress');
const holdTimerEl = document.getElementById('hold-timer');

// ステージ2要素
const currentDirectionEl = document.getElementById('current-direction');
const directionNeedle = document.getElementById('direction-needle');
const directionCompassDisplay = document.getElementById('direction-compass-display');
const accuracyIndicator = document.getElementById('accuracy-indicator');
const accuracyText = document.getElementById('accuracy-text');

// 成功メッセージ要素
const successMessage = document.getElementById('success-message');

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
        
        // ステージ6の初期化
        currentMorseWord = generateNewMorseWord();
        console.log('📡 初期モールス信号の単語:', currentMorseWord);
        
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
        
        console.log('✅ ゲーム初期化完了');
        
    } catch (error) {
        console.error('❌ ゲーム初期化エラー:', error);
        alert('ゲームの初期化でエラーが発生しました:\n' + error.message);
    }
}

// センサー許可要求
async function requestSensorPermission() {
    console.log('センサー許可を要求中...');
    console.log('User Agent:', navigator.userAgent);
    
    try {
        // iOS判定
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        console.log('デバイス判定:', { isIOS, isAndroid });
        
        // iOS 13+ でのセンサー許可要求
        if (isIOS && typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('iOS 13+ センサー許可要求開始');
            
            try {
                // DeviceOrientationEventの許可要求
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                console.log('DeviceOrientation許可結果:', orientationPermission);
                
                // DeviceMotionEventの許可要求（利用可能な場合）
                let motionPermission = 'granted';
                if (typeof DeviceMotionEvent.requestPermission === 'function') {
                    motionPermission = await DeviceMotionEvent.requestPermission();
                    console.log('DeviceMotion許可結果:', motionPermission);
                }
                
                if (orientationPermission === 'granted') {
                    console.log('✅ iOS センサー許可成功');
                    permissionGranted = true;
                    startSensorListening();
                    closePermissionModal();
                    return;
                } else {
                    console.log('❌ iOS センサー許可拒否');
                    alert('センサーへのアクセスが拒否されました。\n設定でこのサイトのモーションとセンサーへのアクセスを許可してください。');
                    return;
                }
            } catch (error) {
                console.error('iOS許可要求エラー:', error);
                alert('センサー許可の要求中にエラーが発生しました。\nページを再読み込みして再試行してください。');
                return;
            }
        } 
        // Android または旧iOS
        else {
            console.log('Android/旧iOS - 直接センサー開始');
            permissionGranted = true;
            startSensorListening();
            closePermissionModal();
            
            // 動作確認用のテスト
            setTimeout(() => {
                console.log('3秒後のセンサー値チェック:', { compassHeading, tiltX, tiltY });
                if (compassHeading === 0 && tiltX === 0 && tiltY === 0) {
                    console.warn('センサー値が0のまま');
                    // ダミー値を設定してテスト
                    compassHeading = Math.floor(Math.random() * 360);
                    tiltX = Math.floor(Math.random() * 20) - 10;
                    tiltY = Math.floor(Math.random() * 20) - 10;
                    updateSensorDisplay();
                    console.log('ダミー値を設定:', { compassHeading, tiltX, tiltY });
                }
            }, 3000);
        }
        
    } catch (error) {
        console.error('センサー許可処理エラー:', error);
        alert('センサー許可処理でエラーが発生しました:\n' + error.message);
        
        // 緊急フォールバック
        console.log('緊急フォールバック実行');
        permissionGranted = true;
        closePermissionModal();
        
        // テスト用のダミー値を設定
        setInterval(() => {
            compassHeading = (compassHeading + 1) % 360;
            tiltX = Math.sin(Date.now() / 1000) * 10;
            tiltY = Math.cos(Date.now() / 1000) * 10;
            updateSensorDisplay();
            handleStageLogic();
        }, 100);
    }
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
        
        // 初期値設定
        setTimeout(() => {
            console.log('📊 1秒後のセンサー値:', { compassHeading, tiltX, tiltY });
            
            // センサーが動作していない場合の検出と対策
            if (compassHeading === 0 && tiltX === 0 && tiltY === 0) {
                console.warn('⚠️ センサー値が0のまま - テストイベントを発火');
                
                // テスト用のイベントを手動発火
                const testEvent = new DeviceOrientationEvent('deviceorientation', {
                    alpha: 45,    // コンパス値
                    beta: 10,     // X軸の傾き
                    gamma: 5,     // Y軸の傾き
                    absolute: true
                });
                
                handleOrientation(testEvent);
                console.log('🧪 テストイベントを発火しました');
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
function startSmoothAnimation() {
    function animate() {
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
        
        // UI更新
        updateSensorDisplaySmooth();
        updateNeedlePositions();
        
        // 現在のステージに応じて処理
        handleStageLogic();
        
        // 次のフレームをスケジュール
        animationFrameId = requestAnimationFrame(animate);
    }
    
    animate();
}

// 滑らかなセンサー値表示更新
function updateSensorDisplaySmooth() {
    if (compassValueEl) compassValueEl.textContent = `${Math.round(smoothCompassHeading)}°`;
    if (tiltXEl) tiltXEl.textContent = `${Math.round(smoothTiltX)}°`;
    if (tiltYEl) tiltYEl.textContent = `${Math.round(smoothTiltY)}°`;
}

// 針の位置更新
function updateNeedlePositions() {
    // ステージ1のコンパス針
    if (compassNeedle) {
        compassNeedle.style.transform = `translate(-50%, -100%) rotate(${smoothCompassHeading}deg)`;
    }
    if (compassDisplay) {
        compassDisplay.textContent = `${Math.round(smoothCompassHeading)}°`;
    }
    
    // ステージ2の方向針
    if (directionNeedle) {
        directionNeedle.style.transform = `translate(-50%, -100%) rotate(${smoothCompassHeading}deg)`;
    }
    if (directionCompassDisplay) {
        directionCompassDisplay.textContent = `${Math.round(smoothCompassHeading)}°`;
    }
    
    // ステージ4の水平バブル
    const levelBubble = document.getElementById('level-bubble');
    if (levelBubble) {
        // 傾きに基づいてバブルの位置を計算
        const maxOffset = 80; // ピクセル
        const offsetX = Math.max(-maxOffset, Math.min(maxOffset, smoothTiltY * 2));
        const offsetY = Math.max(-maxOffset, Math.min(maxOffset, smoothTiltX * 2));
        
        levelBubble.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }
    
    // ステージ5のミニコンパス針
    const miniCompassNeedle = document.getElementById('mini-compass-needle');
    if (miniCompassNeedle) {
        miniCompassNeedle.style.transform = `translate(-50%, -100%) rotate(${smoothCompassHeading}deg)`;
    }
    const miniCompassDisplay = document.getElementById('mini-compass-display');
    if (miniCompassDisplay) {
        miniCompassDisplay.textContent = `${Math.round(smoothCompassHeading)}°`;
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
            shakeCount++;
            lastShakeTime = now;
            console.log('シェイク検出:', shakeCount);
        }
    }
}

// 廃止: updateSensorDisplay - updateSensorDisplaySmoothに置き換え
// この関数は滑らかなアニメーション実装により不要

// ステージ別のロジック処理
function handleStageLogic() {
    switch (currentStage) {
        case 1:
            handleStage1Logic();
            break;
        case 2:
            handleStage2Logic();
            break;
        case 3:
            handleStage3Logic();
            break;
        case 4:
            handleStage4Logic();
            break;
        case 5:
            handleStage5Logic();
            break;
        case 6:
            handleStage6Logic();
            break;
    }
}

// ステージ1: コンパス45度チャレンジ
function handleStage1Logic() {
    // 45度に近いかチェック（±5度の許容範囲）
    const target = 45;
    const tolerance = 5;
    
    // 最短角度差を使用
    const angleDiff = Math.abs(getShortestAngleDifference(smoothCompassHeading, target));
    const isNearTarget = angleDiff <= tolerance;
    
    if (isNearTarget && !isHolding) {
        // 保持開始
        isHolding = true;
        holdStartTime = Date.now();
        startHoldTimer();
    } else if (!isNearTarget && isHolding) {
        // 保持中断
        stopHoldTimer();
    }
}

// 保持タイマー開始
function startHoldTimer() {
    holdInterval = setInterval(() => {
        holdTimer = (Date.now() - holdStartTime) / 1000;
        
        // プログレスバー更新
        const progress = Math.min((holdTimer / 3) * 100, 100);
        if (holdProgress) holdProgress.style.width = `${progress}%`;
        if (holdTimerEl) holdTimerEl.textContent = `${holdTimer.toFixed(1)}秒維持中`;
        
        // 3秒達成でクリア
        if (holdTimer >= 3) {
            stopHoldTimer();
            stageComplete('ステージ1クリア！\n45°を3秒間維持できました！');
        }
    }, 100);
}

// 保持タイマー停止
function stopHoldTimer() {
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
    isHolding = false;
    holdTimer = 0;
    
    // UI リセット
    if (holdProgress) holdProgress.style.width = '0%';
    if (holdTimerEl) holdTimerEl.textContent = '0.0秒維持中';
}

// ステージ2: 東北を向く
function handleStage2Logic() {
    // 現在の方角を計算
    const direction = getDirectionFromHeading(smoothCompassHeading);
    if (currentDirectionEl) currentDirectionEl.textContent = direction;
    
    // 東北（45度）に近いかチェック
    const target = 45; // 東北は45度
    const tolerance = 10; // 許容範囲を少し広く
    
    // 最短角度差を使用
    const difference = Math.abs(getShortestAngleDifference(smoothCompassHeading, target));
    
    // 精度表示更新
    if (difference <= tolerance) {
        accuracyIndicator.classList.add('success');
        if (difference <= 5) {
            accuracyText.textContent = '完璧！東北を向いています！';
            // 2秒後にクリア
            setTimeout(() => {
                stageComplete('ステージ2クリア！\n東北の方角を見つけました！');
            }, 2000);
        } else {
            accuracyText.textContent = '良い感じです！もう少し調整してください。';
        }
    } else {
        accuracyIndicator.classList.remove('success');
        if (difference <= 20) {
            accuracyText.textContent = '近づいています！';
        } else {
            accuracyText.textContent = '方角を調整してください';
        }
    }
}

// ステージ3: シェイクチャレンジ
function handleStage3Logic() {
    const targetShakes = 5;
    const shakeProgress = document.getElementById('shake-progress');
    const shakeCountDisplay = document.getElementById('shake-count');
    
    if (shakeCountDisplay) {
        shakeCountDisplay.textContent = `${shakeCount} / ${targetShakes}`;
    }
    
    if (shakeProgress) {
        const progress = Math.min((shakeCount / targetShakes) * 100, 100);
        shakeProgress.style.width = `${progress}%`;
    }
    
    if (shakeCount >= targetShakes) {
        setTimeout(() => {
            stageComplete('ステージ3クリア！\nシェイクを5回検出しました！');
        }, 1000);
    }
}

// ステージ4: 水平維持チャレンジ
function handleStage4Logic() {
    const tiltTolerance = 5; // ±5度の許容範囲
    const requiredTime = 3000; // 3秒間
    
    const tiltMagnitude = Math.sqrt(smoothTiltX * smoothTiltX + smoothTiltY * smoothTiltY);
    const isLevel = tiltMagnitude <= tiltTolerance;
    
    const levelIndicator = document.getElementById('level-indicator');
    const levelTimer = document.getElementById('level-timer');
    const tiltDisplay = document.getElementById('tilt-magnitude');
    
    if (tiltDisplay) {
        tiltDisplay.textContent = `傾き: ${Math.round(tiltMagnitude)}°`;
    }
    
    if (isLevel && !isHolding) {
        // 水平維持開始
        isHolding = true;
        holdStartTime = Date.now();
        if (levelIndicator) levelIndicator.classList.add('success');
    } else if (!isLevel && isHolding) {
        // 水平維持中断
        isHolding = false;
        holdTimer = 0;
        if (levelIndicator) levelIndicator.classList.remove('success');
    }
    
    if (isHolding) {
        holdTimer = Date.now() - holdStartTime;
        const progress = Math.min((holdTimer / requiredTime) * 100, 100);
        
        if (levelTimer) {
            levelTimer.textContent = `${(holdTimer / 1000).toFixed(1)}秒維持中`;
        }
        
        const levelProgress = document.getElementById('level-progress');
        if (levelProgress) {
            levelProgress.style.width = `${progress}%`;
        }
        
        if (holdTimer >= requiredTime) {
            isHolding = false;
            stageComplete('ステージ4クリア！\n3秒間水平を維持しました！');
        }
    } else {
        if (levelTimer) {
            levelTimer.textContent = '0.0秒維持中';
        }
    }
}

// ステージ5: 複合チャレンジ
function handleStage5Logic() {
    const targetDirection = 0; // 北（0度）
    const directionTolerance = 10;
    const tiltTolerance = 5;
    const requiredShakes = 3;
    
    // 北を向いているかチェック
    const directionDiff = Math.abs(getShortestAngleDifference(smoothCompassHeading, targetDirection));
    const isFacingNorth = directionDiff <= directionTolerance;
    
    // 水平かチェック
    const tiltMagnitude = Math.sqrt(smoothTiltX * smoothTiltX + smoothTiltY * smoothTiltY);
    const isLevel = tiltMagnitude <= tiltTolerance;
    
    // 全条件を満たしているかチェック
    const allConditionsMet = isFacingNorth && isLevel && shakeCount >= requiredShakes;
    
    // UI更新
    const northIndicator = document.getElementById('north-indicator');
    const levelIndicator5 = document.getElementById('level-indicator-5');
    const shakeIndicator = document.getElementById('shake-indicator');
    const finalStatus = document.getElementById('final-status');
    
    if (northIndicator) {
        northIndicator.className = 'condition-indicator ' + (isFacingNorth ? 'success' : '');
        northIndicator.textContent = `北向き: ${isFacingNorth ? '✓' : '✗'} (${Math.round(directionDiff)}°差)`;
    }
    
    if (levelIndicator5) {
        levelIndicator5.className = 'condition-indicator ' + (isLevel ? 'success' : '');
        levelIndicator5.textContent = `水平: ${isLevel ? '✓' : '✗'} (${Math.round(tiltMagnitude)}°傾き)`;
    }
    
    if (shakeIndicator) {
        shakeIndicator.className = 'condition-indicator ' + (shakeCount >= requiredShakes ? 'success' : '');
        shakeIndicator.textContent = `シェイク: ${shakeCount}/${requiredShakes} ${shakeCount >= requiredShakes ? '✓' : ''}`;
    }
    
    if (finalStatus) {
        if (allConditionsMet) {
            finalStatus.textContent = '🎉 全ての条件をクリア！';
            finalStatus.className = 'final-status success';
            setTimeout(() => {
                stageComplete('ステージ5クリア！\n全ての条件を満たしました！');
            }, 2000);
        } else {
            finalStatus.textContent = '条件を満たしてください';
            finalStatus.className = 'final-status';
        }
    }
}

// ステージ6: バイブレーションモールス信号
function handleStage6Logic() {
    // このステージではセンサーロジックは不要
    // バイブレーション再生とテキスト入力の管理のみ
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
async function playMorseVibration(word) {
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
function checkMorseInput() {
    const inputElement = document.getElementById('morse-input');
    const hintElement = document.getElementById('morse-hint');
    
    if (!inputElement) return;
    
    const input = inputElement.value.toUpperCase().trim();
    
    console.log('📝 入力チェック:', input, 'vs', currentMorseWord);
    
    if (input === currentMorseWord) {
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
            stageComplete('ステージ6クリア！\nモールス信号を解読できました！\n🎊 おめでとうございます！');
        }, 1500);
    } else if (input.length > 0) {
        // 入力中の判定
        if (currentMorseWord.startsWith(input)) {
            // 部分一致
            inputElement.style.borderColor = '#999999';
            inputElement.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            if (hintElement) {
                hintElement.textContent = `👍 良い感じです！続けてください... (${input.length}/${currentMorseWord.length}文字)`;
                hintElement.style.color = '#999999';
            }
        } else {
            // 不一致
            inputElement.style.borderColor = '#ff6b6b';
            inputElement.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
            if (hintElement) {
                hintElement.textContent = `❌ 違います。目標: ${currentMorseWord.length}文字の英単語`;
                hintElement.style.color = '#ff6b6b';
            }
        }
    } else {
        // 空の入力
        inputElement.style.borderColor = '#333333';
        inputElement.style.backgroundColor = 'transparent';
        if (hintElement) {
            hintElement.textContent = `💡 ヒント: ${currentMorseWord.length}文字の英単語です`;
            hintElement.style.color = '#666666';
        }
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
    successMessage.textContent = message;
    successModal.classList.add('active');
}

// 次のステージへ進む
function goToNextStage() {
    successModal.classList.remove('active');
    
    // 現在のステージを非表示
    const currentStageEl = document.getElementById(`stage-${currentStage}`);
    if (currentStageEl) {
        currentStageEl.classList.remove('active');
    }
    
    // 次のステージへ
    currentStage++;
    
    // ステージ6まで実装済み
    if (currentStage > 6) {
        alert('🎉 すべてのステージをクリアしました！\nお疲れ様でした！');
        currentStage = 0; // リセット
    }
    
    // 新しいステージを表示
    const nextStageEl = document.getElementById(`stage-${currentStage}`);
    if (nextStageEl) {
        nextStageEl.classList.add('active');
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
    if (stageInfo) {
        stageInfo.textContent = `ステージ ${currentStage}`;
    }
}

// ステージ状態リセット
function resetStageState() {
    // 共通状態リセット
    stopHoldTimer();
    isHolding = false;
    holdTimer = 0;
    
    // ステージ2の状態リセット
    if (accuracyIndicator) {
        accuracyIndicator.classList.remove('success');
    }
    if (accuracyText) {
        accuracyText.textContent = '方角を調整してください';
    }
    
    // ステージ3の状態リセット（シェイクカウンタはリセットしない）
    // shakeCount は累積値として維持
    
    // ステージ4の状態リセット
    const levelIndicator = document.getElementById('level-indicator');
    if (levelIndicator) {
        levelIndicator.classList.remove('success');
    }
    
    // ステージ5の状態リセット
    const levelIndicator5 = document.getElementById('level-indicator-5');
    if (levelIndicator5) {
        levelIndicator5.classList.remove('success');
    }
    
    // ステージ6の状態リセット
    if (currentStage === 6) {
        isPlayingMorse = false;
        playerInput = '';
        const morseInput = document.getElementById('morse-input');
        const morseHint = document.getElementById('morse-hint');
        const morseStatus = document.getElementById('morse-status');
        
        if (morseInput) {
            morseInput.value = '';
            morseInput.style.borderColor = '#333333';
        }
        if (morseHint) morseHint.textContent = '';
        if (morseStatus) morseStatus.textContent = '新しいモールス信号を再生する準備ができました';
        
        // 新しい単語を生成
        currentMorseWord = generateNewMorseWord();
        console.log('新しいモールス信号の単語:', currentMorseWord);
    }
    
    // 新しいステージ開始時にシェイクカウントをリセット（ステージ5は除く）
    if (currentStage === 3) {
        shakeCount = 0;
        shakeDetected = false;
    } else if (currentStage === 5) {
        // ステージ5ではシェイクカウントをリセット
        shakeCount = 0;
        shakeDetected = false;
    }
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
    const currentStageSpan = document.getElementById('debug-current-stage');
    if (currentStageSpan) {
        currentStageSpan.textContent = currentStage;
    }
    
    // ボタンの状態更新
    const buttons = document.querySelectorAll('.debug-stage-btn');
    buttons.forEach((btn, index) => {
        btn.disabled = (index === currentStage);
    });
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