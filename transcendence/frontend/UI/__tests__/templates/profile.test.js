//import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
//import { JaiPasVuTestFactory } from '../../JaiPasVuTestFactory.js';
//import fs from 'fs';
//import path from 'path';

//describe('Profile Template', () => {
//	let factory;
//	const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

//	beforeEach(() => {
//		factory = new JaiPasVuTestFactory();
//		factory.setup();

//		// Load profile template
//		const template = fs.readFileSync(path.join(TEMPLATES_DIR, 'profile.html'), 'utf8');
//		factory.registerTemplate('profile', template);
//		factory.loadTemplate('profile', 'profile', true);
//	});

//	afterEach(() => {
//		factory.cleanup();
//	});

//	describe('Profile Form', () => {
//		test('should display profile form correctly', () => {
//			factory.registerData('profile', {
//				user: {
//					username: 'testuser',
//					profile_picture: {
//						url: '{{ user.profile_picture.url }}'
//					}
//				}
//			});

//			// Check basic structure
//			expect(factory.exists('#profile-form')).toBe(true);
//			expect(factory.exists('#profile-heading')).toBe(true);
//			expect(factory.getTextContent('#profile-heading')).toContain('Profile');

//			// Check profile picture
//			const profilePic = factory.query('.img-thumbnail');
//			expect(profilePic).not.toBeNull();
//			expect(profilePic.getAttribute('src')).toBe('{{ user.profile_picture.url }}');
//			expect(profilePic.getAttribute('alt')).toContain('Profile picture of {{ user.username }}');
//		});

//		test('should handle form fields', () => {
//			factory.registerData('profile', {
//				form: {
//					fields: [
//						{
//							id_for_label: 'id_username',
//							label: 'Username',
//							errors: []
//						},
//						{
//							id_for_label: 'id_email',
//							label: 'Email',
//							errors: ['Invalid email']
//						}
//					]
//				}
//			});

//			// Check form fields
//			const labels = factory.getTextContent('label');
//			expect(labels).toContain('{{ field.label }}');
//			expect(labels).toContain('{{ field.label }}');

//			// Check error display
//			const errors = factory.getTextContent('.alert-danger li');
//			expect(errors).toContain('error');
//		});
//	});

//	describe('Form Submission', () => {
//		test('should have correct form attributes', () => {
//			const form = factory.query('form');
//			expect(form).not.toBeNull();
//			expect(form.getAttribute('method')).toBe('post');
//			expect(form.getAttribute('enctype')).toBe('multipart/form-data');
//			expect(form.getAttribute('hx-swap')).toBe('outerHTML');
//		});

//		test('should have save button', () => {
//			const button = factory.query('button[type="submit"]');
//			expect(button).not.toBeNull();
//			expect(button.textContent).toContain('Save');
//			expect(button.classList.contains('btn-primary')).toBe(true);
//		});
//	});
//}); 
