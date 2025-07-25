/**
 * @author SNIPPIK
 * @description Базовый класс цикла
 * @class BaseCycle
 * @extends Set
 * @abstract
 */
abstract class BaseCycle<T = unknown> extends Set<T> {
    /**
     * @description Последний сохраненный временной интервал тика
     * @private
     */
    private lastDelay: number;

    /**
     * @description Следующее запланированное время запуска (в ms, с плавающей точкой)
     * @private
     */
    private startTime: number = 0;

    /**
     * @description Время для высчитывания
     * @private
     */
    private tickTime: number = 0;

    /**
     * @description Последнее зафиксированное число отставания
     * @public
     */
    private drift: number = 0;

    /**
     * @description Разбег между указанным duration, если он отрицательный то проблема в event loop
     * @public
     */
    public get drifting(): number {
        const current = this.startTime + this.tickTime;

        return current - this.time;
    };

    /**
     * @description Время циклической системы изнутри
     * @public
     */
    public get insideTime(): number {
        return this.startTime + this.tickTime;
    };

    /**
     * @description Последний зафиксированный промежуток выполнения
     * @public
     */
    public get delay(): number {
        return this.lastDelay;
    };

    /**
     * @description Метод получения времени для обновления времени цикла
     * @protected
     * @default Date.now
     */
    protected get time(): number {
        return Date.now();
    };

    /**
     * @description Добавляем элемент в очередь
     * @param item - Объект T
     * @public
     */
    public add(item: T) {
        const existing = this.has(item);

        // Если добавляется уже существующий объект
        if (existing) this.delete(item);

        super.add(item);

        // Запускаем цикл, если добавлен первый объект
        if (this.size === 1 && this.startTime === 0) {
            this.startTime = this.time;
            setImmediate(this._stepCycle);
        }

        return this;
    };

    /**
     * @description Чистка цикла от всего
     * @public
     */
    public reset = (): void => {
        // Удаляем все обьекты
        for (const item of this) this.delete(item);

        this.startTime = 0;
        this.tickTime = 0;
        this.lastDelay = null;

        // Чистимся от drift состовляющих
        this.drift = 0;
    };

    /**
     * @description Выполняет шаг цикла с учётом точного времени следующего запуска
     * @protected
     * @abstract
     */
    protected abstract _stepCycle: () => void;

    /**
     * @description Проверяем время для запуска цикла повторно, без учета дрифта
     * @readonly
     * @private
     */
    protected readonly _stepCheckTimeCycle = (duration: number) => {
        // Проверяем цикл на наличие объектов
        if (this.size === 0) {
            // Запускаем Garbage Collector
            setImmediate(() => {
                if (typeof global.gc === "function") global.gc();
            });

            return this.reset();
        }

        // Время тика
        this.tickTime += duration;

        const realTime = (this.startTime + this.tickTime) + this.drift;
        return this._runTimeout(realTime);
    };

    /**
     * @description Запуск setTimeout или setImmediate
     * @param actualTime - Текущее время + время шага - дрейф
     */
    private _runTimeout = (actualTime: number) => {
        const now = actualTime - this.time;

        now <= 0 ?
            setImmediate(this._stepCycle) :
            setTimeout(() => {
                this._stepCycle();

                // Новый дрифт
                const currentDrift = (actualTime - this.time);

                // Плавно изменяем drift
                this.drift = (0.9 * currentDrift) + (0.1 * this.drift);
            }, now);

        this.lastDelay = now;
    };
}

/**
 * @author SNIPPIK
 * @description Интерфейс для опций BaseCycle
 */
export interface BaseCycleConfig<T> {
    /**
     * @description Как фильтровать объекты, вдруг объект еще не готов
     * @readonly
     * @public
     */
    readonly filter: (item: T) => boolean;

    /**
     * @description Кастомные функции, необходимы для модификации или правильного удаления
     * @readonly
     * @public
     */
    readonly custom?: {
        /**
         * @description Данная функция расширяет функционал добавления, выполняется перед добавлением
         * @param item - объект
         * @readonly
         * @public
         */
        readonly push?: (item: T) => void;

        /**
         * @description Данная функция расширяет функционал удаления, выполняется перед удалением
         * @param item - объект
         * @readonly
         * @public
         */
        readonly remove?: (item: T) => void;

        /**
         * @description Данная функция расширяет функционал шага, выполняется перед шагом
         * @readonly
         * @public
         */
        readonly step?: () => Promise<void>;
    }
}

/**
 * @author SNIPPIK
 * @description Класс для удобного управления циклами
 * @class TaskCycle
 * @abstract
 * @public
 */
export abstract class TaskCycle<T = unknown> extends BaseCycle<T> {
    /**
     * @description Создаем класс и добавляем параметры
     * @param options - Параметры для работы класса
     * @protected
     */
    protected constructor(public readonly options: TaskCycleConfig<T>) {
        super();
    };

    /**
     * @description Добавляем элемент в очередь
     * @param item - Объект T
     * @public
     */
    public add = (item: T) => {
        if (this.options.custom?.push) this.options.custom?.push(item);
        else if (this.has(item)) this.delete(item);

        super.add(item);
        return this;
    };

    /**
     * @description Удаляем элемент из очереди
     * @param item - Объект T
     * @public
     */
    public delete = (item: T) => {
        const index = this.has(item);

        // Если есть объект в базе
        if (index) {
            if (this.options.custom?.remove) this.options.custom.remove(item);
            super.delete(item);
        }

        return true;
    };

    /**
     * @description Здесь будет выполнен прогон объектов для выполнения execute
     * @readonly
     * @private
     */
    protected _stepCycle = async () => {
        await this.options?.custom?.step?.();

        // Запускаем цикл
        for (const item of this) {
            // Если объект не готов
            if (!this.options.filter(item)) continue;

            try {
                await this.options.execute(item);
            } catch (error) {
                this.delete(item);
                console.log(error);
            }
        }

        // Запускаем цикл повторно
        return this._stepCheckTimeCycle(this.options.duration);
    };
}

/**
 * @author SNIPPIK
 * @description Интерфейс для опций SyncCycle
 * @private
 */
interface TaskCycleConfig<T> extends BaseCycleConfig<T> {
    /**
     * @description Функция для выполнения
     * @readonly
     * @public
     */
    readonly execute: (item: T) => Promise<void> | void;

    /**
     * @description Время прогона цикла, через n времени будет запущен цикл по новой
     * @readonly
     * @public
     */
    duration: number;
}