/* eslint-disable prettier/prettier */
import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomerRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Could no find any customer with the given id');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts) {
      throw new AppError('Could not find any products');
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    const checkExistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkExistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkExistentProducts[0].id}`,
      );
    }

    const findProductswithnoQuantityAvailable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductswithnoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductswithnoQuantityAvailable[0].quantity} is not available for ${findProductswithnoQuantityAvailable[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existentProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
