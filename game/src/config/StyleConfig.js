/**
 * Конфигурация стилей
 * Централизованное управление всеми константами стилей UI-компонентов
 * Позволяет избежать жёстко заданных «магических чисел» и «магических строк»
 */

// ============================================
// Конфигурация цветов (Colors)
// ============================================
export const COLORS = {
    // Основные цвета
    primary: 0x4CAF50,
    light: 0x66BB6A,
    dark: 0x388E3C,
    white: 0xffffff,
    black: 0x000000,
    
    // Вторичные цвета
    secondary: 0x2196F3,
    secondaryLight: 0x42A5F5,
    secondaryDark: 0x1976D2,
    
    // Предупреждающие цвета
    warning: 0xFF9800,
    warningLight: 0xFFB74D,
    warningDark: 0xF57C00,
    
    // Цвета диалогового окна
    dialogBg: 0x1976D2,
    dialogStroke: 0xffffff,
    
    // Цвета сюжетного диалога
    storyPrimary: 0x4e342e,
    storyLight: 0x7b5e57,
    storyDark: 0x260e04,
    
    // Цвета частиц
    particleRed: 0xff0000,
    particleOrange: 0xff9800,
    particleYellow: 0xffeb3b
};

// ============================================
// Конфигурация шрифтов (Typography)
// ============================================
export const TYPOGRAPHY = {
    fontFamily: {
        default: 'Arial, sans-serif',
        pixel: '"Press Start 2P"',
        monospace: 'Courier New, monospace'
    },
    
    fontSize: {
        xs: '14px',
        sm: '16px',
        md: '18px',
        lg: '20px',
        xl: '24px',
        xxl: '32px'
    },
    
    fontWeight: {
        normal: 'normal',
        bold: 'bold',
        bolder: 'bolder'
    },
    
    textColor: {
        primary: '#ffffff',
        secondary: '#cccccc',
        dark: '#000000',
        disabled: '#666666'
    }
};

// ============================================
// Конфигурация кнопок (Button Styles)
// ============================================
export const BUTTON_STYLES = {
    // Размер кнопки по умолчанию
    fontSize: 20,
    cornerRadius: 15,
    strokeWidth: 2,
    
    // Внутренние отступы
    padding: {
        left: 20,
        right: 20,
        top: 15,
        bottom: 15
    },
    
    // Параметры анимации взаимодействия
    hover: {
        scale: 1.05,
        duration: 100,
        ease: 'Back.easeOut'
    },
    
    normal: {
        scale: 1,
        duration: 100,
        ease: 'Back.easeIn'
    },
    
    press: {
        scale: 0.95,
        duration: 50,
        ease: 'Sine.easeInOut'
    },
    
    release: {
        scale: 1.05,
        duration: 50,
        ease: 'Sine.easeInOut'
    },
    
    // Анимация появления
    entrance: {
        duration: 300,
        ease: 'Back.easeOut',
        maxDelay: 200
    }
};

// ============================================
// Конфигурация диалогов (Dialog Styles)
// ============================================
export const DIALOG_STYLES = {
    // Базовые размеры
    width: 400,
    cornerRadius: 20,
    strokeWidth: 3,
    
    // Стиль заголовка
    title: {
        fontSize: '24px',
        fontWeight: 'bold'
    },
    
    // Стиль содержимого
    content: {
        fontSize: '18px',
        wrapWidth: 340
    },
    
    // Стиль кнопок
    button: {
        fontSize: 18,
        cornerRadius: 10
    },
    
    // Внутренние отступы
    padding: {
        left: 20,
        right: 20,
        top: 20,
        bottom: 20,
        title: 25,
        content: 30,
        action: 15
    },
    
    // Уровни глубины (z-order)
    depth: {
        base: 100,
        button: 101
    },
    
    // Модальная подложка
    modal: {
        coverColor: 0x000000,
        coverAlpha: 0.7,
        durationIn: 500,
        durationOut: 300
    },
    
    // Анимации
    animation: {
        transitInEase: 'Back.easeOut',
        transitOutEase: 'Back.easeIn'
    }
};

// ============================================
// Конфигурация сюжетного диалога (Story TextBox Styles)
// ============================================
export const STORY_TEXTBOX_STYLES = {
    // Стиль метки имени
    nameLabel: {
        fontSize: '18px',
        cornerRadius: 10,
        strokeWidth: 2,
        padding: {
            left: 15,
            right: 15,
            top: 8,
            bottom: 8
        }
    },
    
    // Стиль основного диалогового окна
    textBox: {
        wrapWidth: 500,
        fixedWidth: 520,
        fixedHeight: 80,
        cornerRadius: 20,
        strokeWidth: 2,
        fontSize: '20px',
        maxLines: 3
    },
    
    // Стиль аватара
    avatar: {
        displayWidth: 60,
        displayHeight: 60
    },
    
    // Стиль иконки продолжения
    actionIcon: {
        displayWidth: 24,
        displayHeight: 24
    },
    
    // Внутренние отступы
    padding: {
        left: 20,
        right: 20,
        top: 20,
        bottom: 20,
        icon: 15,
        text: 10,
        nameBottom: 5,
        nameLeft: 25
    },
    
    // Уровень глубины
    depth: 200,
    
    // Эффект печатной машинки
    typing: {
        defaultSpeed: 50, // миллисекунд на символ
        iconBreath: {
            scale: 1.3,
            duration: 500,
            ease: 'Sine.easeInOut'
        }
    },
    
    // Анимации
    animation: {
        entrance: {
            offsetY: 50,
            duration: 400,
            ease: 'Cubic.easeOut'
        },
        exit: {
            offsetY: 50,
            duration: 300,
            ease: 'Cubic.easeIn'
        }
    },
    
    // Позиция по умолчанию
    defaultPosition: {
        yOffset: -150 // смещение от нижнего края экрана
    }
};

// ============================================
// Конфигурация всплывающего текста (Floating Text Styles)
// ============================================
export const FLOATING_TEXT_STYLES = {
    fontSize: '24px',
    strokeColor: '#000000',
    strokeThickness: 4,
    
    animation: {
        offsetY: -100,
        duration: 1500,
        ease: 'Cubic.easeOut'
    }
};

// ============================================
// Конфигурация частиц (Particle Effect Styles)
// ============================================
export const PARTICLE_STYLES = {
    speed: {
        min: -200,
        max: 200
    },
    
    angle: {
        min: 0,
        max: 360
    },
    
    scale: {
        start: 0.1,
        end: 0
    },
    
    lifespan: 600,
    blendMode: 'ADD',
    
    // Комбинация цветов
    tint: [COLORS.particleRed, COLORS.particleOrange, COLORS.particleYellow],
    
    // Задержка перед авто-удалением
    destroyDelay: 1000
};

// ============================================
// Конфигурация по умолчанию для скруглённого прямоугольника (RoundRectangle Defaults)
// ============================================
export const ROUND_RECTANGLE_DEFAULTS = {
    cornerRadius: 15,
    strokeWidth: 0,
    strokeColor: null,
    fallbackSize: {
        width: 100,
        height: 50
    }
};

// ============================================
// Комбинированный объект со всеми конфигурациями (необязательно)
// ============================================
export const UI_STYLES = {
    colors: COLORS,
    typography: TYPOGRAPHY,
    button: BUTTON_STYLES,
    dialog: DIALOG_STYLES,
    storyTextBox: STORY_TEXTBOX_STYLES,
    floatingText: FLOATING_TEXT_STYLES,
    particle: PARTICLE_STYLES,
    roundRect: ROUND_RECTANGLE_DEFAULTS
};

// ============================================
// Вспомогательная функция: получить строку стиля шрифта
// ============================================
export function getFontStyle(size = 'md', family = 'default', weight = 'normal') {
    return {
        fontSize: TYPOGRAPHY.fontSize[size] || TYPOGRAPHY.fontSize.md,
        fontFamily: TYPOGRAPHY.fontFamily[family] || TYPOGRAPHY.fontFamily.default,
        fontWeight: TYPOGRAPHY.fontWeight[weight] || TYPOGRAPHY.fontWeight.normal
    };
}

// ============================================
// Вспомогательная функция: получить значение цвета
// ============================================
export function getColor(colorName) {
    return COLORS[colorName] || COLORS.white;
}
