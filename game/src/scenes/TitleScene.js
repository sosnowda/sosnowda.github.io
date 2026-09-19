// Главное меню игры — кнопки на чистом Phaser (без RexUI)
import { RUS } from '../config/RusTheme.js';
import AudioManager from '../systems/AudioManager.js';
import { t, tf, tk, getLang, setLang } from '../systems/i18n.js';
import { bindRestartOnResize } from '../utils/ui.js';
// Раунд 32 (пп.14,15): строка о времени 1:30 в «Информации по игре» (F1)
import { timeRatioInfoLine } from '../systems/WorldClock.js';

/**
 * Раунд 24: фоновый прелоадер «тяжёлой» музыки (таверна/церковь/финалы).
 * 4 трека ~9.6 МБ НЕ входят в preload игры и в кэш SW — они догружаются
 * лоадером Phaser прямо во время меню/игры, к моменту захода в таверну
 * или церковь трек уже в кэше браузера. Не блокирует запуск.
 */
function kickoffBackgroundMusicPreload(scene) {
    if (!scene?.load || scene.registry.get('bgMusicPreloadStarted')) return;
    scene.registry.set('bgMusicPreloadStarted', true);
    const tracks = ['music_town_tavern', 'music_town_church', 'music_victory', 'music_game_over'];
    const pending = tracks.filter((k) => !scene.cache.audio.exists(k));
    if (pending.length === 0) return;
    pending.forEach((k) => scene.load.audio(k, `assets/audio/music/${k}.ogg`));
    try { scene.load.start(); } catch (e) { /* лоадер недоступен — музыка просто не заиграет */ }
}

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('Title');
    }

    create() {
        bindRestartOnResize(this); // раунд 20: любой размер/ориентация окна
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(RUS.bg);
        this.audioManager = new AudioManager(this);

        // Фоновая музыка главного меню
        this.audioManager.playSceneMusic('menu');

        // Раунд 24: тихо догружаем музыку таверны/церкви/финалов в фоне
        kickoffBackgroundMusicPreload(this);

        // Декор: парящие золотые точки
        for (let i = 0; i < 40; i++) {
            const d = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 3),
                0xc9a14a,
                Phaser.Math.FloatBetween(0.2, 0.6)
            );
            this.tweens.add({
                targets: d,
                y: d.y - 30,
                alpha: 0,
                duration: Phaser.Math.Between(2500, 5000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000),
            });
        }

        // Раунд 20: заголовок масштабируется под ширину окна (на телефоне не выпирает)
        const titleSize = Math.max(30, Math.min(66, Math.round(width / 12)));
        this.add.text(width / 2, 110, 'ЛЕТОПИСИ РУСИ', {
            fontFamily: 'Georgia, serif', fontSize: titleSize + 'px', color: '#E8DCC4',
            fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);
        const subSize = Math.max(14, Math.min(22, Math.round(width / 30)));
        this.add.text(width / 2, 110 + titleSize * 0.75 + 18, t('XV век · Поход за утраченной иконой'), {
            fontSize: subSize + 'px', color: '#A89878',
        }).setOrigin(0.5);

        // Кнопки — без "Продолжить" (одноразовая игра).
        // Раунд 58 (п.4 приказа): пункт «Персонаж» из главного меню УДАЛЁН —
        // лист персонажа открывается из игры (кнопка «📜 Персонаж» в HUD);
        // выбор героя идёт через «Новая игра» → окно готовых героев.
        const by = 270;
        this.makeButton(width / 2, by, t('Новая игра'), 0x8B2C1A, 0xB53925, () => this.scene.start('CharacterSelection'));
        // Раунд 57 (п.4 приказа): меню «Помощь» переименовано в «ИНСТРУКЦИЯ»
        this.makeButton(width / 2, by + 68, t('❓ Инструкция'), 0x6b5320, 0x7d6428, () => this.showHelp());
        this.makeButton(width / 2, by + 136, t('⚙ Настройки'), 0x4f4a1e, 0x5f5a26, () => this.showSettings());
        this.makeButton(width / 2, by + 204, t('О игре'), 0x54382a, 0x644536, () => this.about());
        
        // П.26: ESC — переключение в главное меню и обратно
        this.input.keyboard.on('keydown-ESC', () => {
            // Если уже в Title — ничего не делаем (уже в главном меню)
        });
        // П.25: F1 — окно помощи
        this.input.keyboard.on('keydown-F1', () => {
            this.showHelp();
        });
    }

    makeButton(x, y, label, bgColor, hoverColor, callback) {
        const w = 280, h = 56;
        const bg = this.add.rectangle(x, y, w, h, bgColor, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            color: '#E8DCC4',
            stroke: '#000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setFillStyle(hoverColor, 1);
            bg.setScale(1.05);
            text.setScale(1.05);
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(bgColor, 1);
            bg.setScale(1);
            text.setScale(1);
        });
        bg.on('pointerdown', () => {
            bg.setScale(0.95);
            text.setScale(0.95);
        });
        bg.on('pointerup', () => {
            bg.setScale(1.05);
            text.setScale(1.05);
            callback();
        });

        return { bg, text };
    }

    showSimpleDialog(title, message) {
        const { width, height } = this.scale;
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setInteractive();

        // Раунд 39: панель растёт по высоте текста — кнопка «ОК» всегда НИЖЕ текста
        const msgText0 = this.add.text(0, 0, message, {
            fontFamily: 'Arial', fontSize: '16px', color: '#E8DCC4',
            align: 'center', wordWrap: { width: 440 },
        }).setOrigin(0.5);
        const panelW = 500;
        const panelH = Math.min(height - 24, Math.max(250, msgText0.height + 150));
        msgText0.destroy();
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(2, 0xC9A961);

        const titleText = this.add.text(width / 2, height / 2 - panelH / 2 + 34, title, {
            fontFamily: 'Georgia, serif', fontSize: '24px', color: '#C9A961',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const msgText = this.add.text(width / 2, height / 2 - 10, message, {
            fontFamily: 'Arial', fontSize: '16px', color: '#E8DCC4',
            align: 'center', wordWrap: { width: 440 },
        }).setOrigin(0.5);

        const btnW = 140, btnH = 40;
        const btnY = height / 2 + panelH / 2 - 34;
        const btnBg = this.add.rectangle(width / 2, btnY, btnW, btnH, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true });
        const btnText = this.add.text(width / 2, btnY, t('ОК'), {
            fontFamily: 'Georgia, serif', fontSize: '18px', color: '#E8DCC4',
        }).setOrigin(0.5);

        const closeDialog = () => {
            overlay.destroy();
            panel.destroy();
            titleText.destroy();
            msgText.destroy();
            btnBg.destroy();
            btnText.destroy();
        };

        btnBg.on('pointerover', () => btnBg.setFillStyle(0xB53925, 1));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x8B2C1A, 1));
        btnBg.on('pointerup', closeDialog);
        overlay.on('pointerup', closeDialog);
    }

    about() {
        this.showSimpleDialog(t('О игре'), tk('title.about',
            '«Летописи Руси» — браузерная RPG в сеттинге Руси XV века.\n' +
            'Ролевая система: BRP (Basic Roleplaying Universal Game Engine SRD) — ' +
            'характеристики 3d6×5, проверки d100, критический успех 1/20 навыка, ' +
            'особый успех 1/5 навыка, бонус урона по таблице STR+SIZ.\n' +
            'Деньги: рубли, гривны, куны, деньги (Русь XV в.).\n' +
            'Управление: WASD/стрелки — движение, E — действие.\n' +
            'Игра одноразовая — сохранения не поддерживаются.'));
    }

    // П.14: Полное окно помощи
    // Раунд 39 (п.1 заявки): кнопка «Закрыть» БОЛЬШЕ НЕ перекрывает текст —
    // раскладка честная: панель по высоте экрана, текст в своей зоне,
    // при нехватке места шрифт уменьшается, в крайнем случае — прокрутка колесом.
    showHelp() {
        const { width, height } = this.scale;
        // Очищаем старый диалог если есть
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = Math.min(700, width - 24);
        const panelH = Math.min(640, height - 24);
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 20, t('❓ Инструкция'), {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        const helpBody = tk('title.help.body', [
            '🎯 ЦЕЛЬ ИГРЫ:',
            'Ты — беженец в незнакомой деревне. Прижись, найди работу,',
            'завоюй доверие жителей. Достигни репутации +100 или женись.',
            '',
            timeRatioInfoLine(),
            '',
            '🎮 УПРАВЛЕНИЕ:',
            '  WASD / стрелки — движение (все 4 направления)',
            '  E / пробел — взаимодействие (войти в здание, говорить)',
            '  ЛКМ на здании — подойти и войти',
            '  ЛКМ на NPC — подойти и начать разговор',
            '  ПКМ на NPC — показать репутацию и состояние',
            '  F1 — окно помощи',
            '  ESC — главное меню',
            '',
            '⚠ ПРОИГРЫШ:',
            '  • Смерть героя в бою',
            '  • Репутация в деревне −100 → изгнание (только на самом дне!)',
            '  • Вор украдённой иконы сбежал (лимит времени)',
            '',
            '🏆 ВЫИГРЫШ:',
            '  • Репутация в деревне +100 → принят как свой',
            '  • Брак с жителем (репутация +90 у NPC, +50 в деревне, 200 д.)',
            '',
            '⭐ РЕПУТАЦИЯ:',
            '  Повышение: задания, подарки, похвала, выпивка всем.',
            '  Понижение: попрошайничество, угрозы, ночное беспокойство.',
            '  ≤ −30: NPC не говорит. ≤ −50: не торгует. ≤ −80: может напасть.',
            '  Убил жителя? Деревня и все жители −50, родня — до −100.',
            '  Виру за обиду принимает староста: мир за серебро (+30 к вражде).',
        ].join('\n'));

        // Зона текста: между заголовком и кнопкой «Закрыть» (кнопка — внизу панели)
        const padX = 20;
        const btnZoneH = 52;
        const textX = width / 2 - panelW / 2 + padX;
        const textY = height / 2 - panelH / 2 + 56;
        const availTextH = Math.max(80, panelH - 56 - btnZoneH - 12);

        const createHelpText = (fs) => this.add.text(textX, textY, helpBody, {
            fontSize: fs + 'px', color: '#E8DCC4',
            fontFamily: 'Arial, sans-serif',
            stroke: '#000', strokeThickness: 1,
            lineSpacing: 3,
            wordWrap: { width: panelW - padX * 2 },
        }).setOrigin(0, 0).setDepth(202);

        // Подбор шрифта: 13 → 10, пока текст не влезет в свою зону
        let fs = 13;
        let helpText = createHelpText(fs);
        while (helpText.height > availTextH && fs > 10) {
            fs -= 1;
            helpText.setStyle({ ...helpText.style, fontSize: fs + 'px' });
        }

        // Если текст всё ещё выше зоны — маска + прокрутка колесом
        let scrollY = 0;
        let wheelHandler = null;
        let maskGfx = null;
        const overflow = Math.max(0, helpText.height - availTextH);
        if (overflow > 0) {
            maskGfx = this.make.graphics({ add: false });
            maskGfx.fillRect(textX - 4, textY - 4, panelW - padX * 2 + 12, availTextH + 10);
            helpText.setMask(maskGfx.createGeometryMask());
            wheelHandler = (pointer, over, dx, dy) => {
                scrollY = Phaser.Math.Clamp(scrollY + dy, 0, overflow);
                helpText.y = textY - scrollY;
            };
            this.input.on('wheel', wheelHandler);
        }

        // Кнопка закрытия — ВСЕГДА ниже зоны текста (п.1: без перекрытия)
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 30, 140, 35, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeHelp = () => {
            if (wheelHandler) { this.input.removeListener('wheel', wheelHandler); wheelHandler = null; }
            if (maskGfx) { maskGfx.destroy(); maskGfx = null; }
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeHelp);
        overlay.on('pointerup', closeHelp);
        this.input.keyboard.once('keydown-ESC', closeHelp);
        this.input.keyboard.once('keydown-F1', closeHelp);
    }

    // П.15: Настройки (раунд 15: рабочие тумблеры — пишут settings.audio.*,
    // которые реально читает AudioManager во всех сценах, + персист в localStorage;
    // ранее панель писала 'gameSettings', которые никто не читал — звук не отключался)
    showSettings() {
        const { width, height } = this.scale;
        this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
            .setOrigin(0).setInteractive().setDepth(200);
        const panelW = 500, panelH = 430;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x241B15, 1)
            .setStrokeStyle(3, 0xC9A961).setDepth(201);

        this.add.text(width / 2, height / 2 - panelH / 2 + 25, t('⚙ Настройки'), {
            fontSize: '24px', color: '#C9A961', fontStyle: 'bold',
            fontFamily: 'Georgia, serif',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(202);

        // Читаем текущие аудио-настройки (персист в localStorage 'gameSettings.audio')
        const settings = this.readAudioSettings();
        const persist = () => this.writeAudioSettings(settings);
        const redraw = () => this.showSettings();

        const onOff = (v) => t(v ? 'ВКЛ' : 'ВЫКЛ');
        let y = height / 2 - 90;

        // 1. Все звуки
        this.makeToggleButton(width / 2, y, tf('🔊 Все звуки: {0}', onOff(!settings.musicMuted || !settings.sfxMuted)), () => {
            const muteAll = !settings.musicMuted || !settings.sfxMuted;
            settings.musicMuted = muteAll;
            settings.sfxMuted = muteAll;
            persist(); redraw();
        });
        y += 50;

        // 2. Музыка (AudioManager всех сцен слушает registry-ключ)
        this.makeToggleButton(width / 2, y, tf('🎵 Музыка: {0}', onOff(!settings.musicMuted)), () => {
            settings.musicMuted = !settings.musicMuted;
            persist();
            if (settings.musicMuted && this.audioManager) this.audioManager.stopMusic('menu');
            if (!settings.musicMuted && this.audioManager) this.audioManager.playSceneMusic('menu');
            redraw();
        });
        y += 50;

        // 3. Звуковые эффекты (клики/шаги/урон — всё через playSound)
        this.makeToggleButton(width / 2, y, tf('🔊 Эффекты (SFX): {0}', onOff(!settings.sfxMuted)), () => {
            settings.sfxMuted = !settings.sfxMuted;
            persist(); redraw();
        });
        y += 50;

        // 4. Язык интерфейса (раунд 15) — переключение перезагружает страницу.
        // lang= из URL вычищаем, иначе после перезагрузки URL-параметр перебил бы ручной выбор.
        const other = getLang() === 'en' ? 'Русский' : 'English';
        const langLabel = tf('🌐 Язык: {0} → {1}', getLang() === 'en' ? 'English' : 'Русский', other);
        this.makeToggleButton(width / 2, y, langLabel, () => {
            setLang(getLang() === 'en' ? 'ru' : 'en');
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('lang')) {
                    url.searchParams.delete('lang');
                    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
                }
            } catch (e) { /* noop */ }
            window.location.reload();
        });

        // Кнопка закрытия
        const btnBg = this.add.rectangle(width / 2, height / 2 + panelH / 2 - 30, 140, 35, 0x8B2C1A, 1)
            .setStrokeStyle(2, 0xC9A961)
            .setInteractive({ useHandCursor: true }).setDepth(202);
        const btnText = this.add.text(width / 2, height / 2 + panelH / 2 - 30, t('Закрыть'), {
            fontFamily: 'Georgia, serif', fontSize: '16px', color: '#E8DCC4',
        }).setOrigin(0.5).setDepth(203);

        const closeSettings = () => {
            this.children.list.filter(c => c.depth >= 200).forEach(c => c.destroy());
        };
        btnBg.on('pointerup', closeSettings);
        overlay.on('pointerup', closeSettings);
    }

    /** Аудио-настройки: localStorage 'gameSettings.audio' (совместимо с SettingsManager на TestPage). */
    readAudioSettings() {
        const defaults = { musicMuted: false, sfxMuted: false, musicVolume: 0.7, sfxVolume: 0.8 };
        try {
            const raw = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            if (raw && raw.audio) return { ...defaults, ...raw.audio };
        } catch (e) { /* noop */ }
        return defaults;
    }

    /** Записать аудио-настройки: registry-ключи (для AudioManager) + localStorage. */
    writeAudioSettings(s) {
        this.registry.set('settings.audio.musicMuted', !!s.musicMuted);
        this.registry.set('settings.audio.sfxMuted', !!s.sfxMuted);
        this.registry.set('settings.audio.musicVolume', typeof s.musicVolume === 'number' ? s.musicVolume : 0.7);
        this.registry.set('settings.audio.sfxVolume', typeof s.sfxVolume === 'number' ? s.sfxVolume : 0.8);
        try {
            const raw = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            raw.audio = { ...(raw.audio || {}), ...s };
            localStorage.setItem('gameSettings', JSON.stringify(raw));
        } catch (e) { /* noop */ }
    }

    makeToggleButton(x, y, label, callback) {
        const bg = this.add.rectangle(x, y, 300, 36, 0x4a3520, 0.95)
            .setStrokeStyle(1, 0xC9A961)
            .setInteractive({ useHandCursor: true })
            .setDepth(202);
        const text = this.add.text(x, y, label, {
            fontSize: '14px', color: '#E8DCC4',
            fontFamily: 'Georgia, serif',
        }).setOrigin(0.5).setDepth(203);
        bg.on('pointerup', () => {
            callback();
        });
        bg.on('pointerover', () => bg.setFillStyle(0x5a4530, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x4a3520, 0.95));
    }
}
