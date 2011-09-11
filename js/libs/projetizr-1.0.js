/*
 Author: 		José P. Airosa
 Description: 	Projetizr is a tool for web developers and frontend web designers where you will be enable to use an image as a watermark.
 				You can assign images to keystrokes and enable/disable them on-the-fly, drag background image to better suit your needs and scope your work to a specific element.
 */
(function($) {
	/**
	 * Global Variables
	 */
	var _is_being_pressed = [];
	var _wrapper = null;
	var _current_image = -1;
	var _settings = {};
	var _callback_queue = [];
	var _background = {};
	var _background_position = {x: null, y: 0};
	var _last_mouse_position = {x: null, y: null};
	var _is_in_scope = false;
	var _current_scope = null;
	var _reset_scope = false;
	var _drag_keep_position = false;
	var _ruler_is_open = false;
	var _ruler_guides_are_open = false;
	
	/**
	 * Check if a given value is found in a specific array
	 * @param needle The value to check
	 * @param haystack The array to match the needle on
	 * @param argStrict Matching cases
	 * @return bool If the needle is found in the haystack
	 */
	var in_array = function (needle, haystack, argStrict) {
		var key = '',
				strict = !! argStrict;

		if (strict) {
			for (key in haystack) {
				if (haystack[key] === needle) {
					return true;
				}
			}
		} else {
			for (key in haystack) {
				if (haystack[key] == needle) {
					return true;
				}
			}
		}

		return false;
	};

	/**
	 * Add a given method to our internal callback queue
	 * @param callback
	 */
	var add_action = function(callback) {
		_callback_queue.push(callback);
	};

	/**
	 *
	 * @param obj
	 */
	var set_wrapper_to_ = function(obj) {
		$(".projetizr-wrapper").each(function() {
			var inner_html_backup = "";
			var parent = $(this).parent();
			inner_html_backup = $(this).html();
			$(this).remove();
			parent.append(inner_html_backup);
		});
		_wrapper = null;
		$(obj).wrapInner('<div class="projetizr-wrapper"></div>');
		_wrapper = $(".projetizr-wrapper");
	};
	
	/**
	 * Converts a ascii value to its corresponding char value.
	 * In here we can have specific conversions.
	 * @return array char value array with the current keys being pressed
	 */
	var convert_keys_to_string = function() {
		var combination = [];
		for (var i in _is_being_pressed) {
			switch (_is_being_pressed[i]) {
				case 16:
					combination.push('shift');
					set_helper_message('shift');
					break;
				case 17:
					combination.push('ctrl');
					set_helper_message('ctrl');
					break;
				case 18:
					combination.push('alt');
					set_helper_message('alt');
					break;
				case 27:
					combination.push('esc');
					set_helper_message('esc');
					break;
				default:
					var combination_string = String.fromCharCode(_is_being_pressed[i]);
					combination.push(combination_string.toLowerCase());
					break;
			}
		}
		return combination;
	};

	/**
	 * Converts a given array combination to a string readable comabination
	 * @param combination
	 */
	var combination_to_string = function(combination) {
		return combination.join('+');
	};

	/**
	 * Get the ascii key of the current key being pressed
	 * @param e keypress event
	 * @return int ascii code
	 */
	var get_key = function(e) {
		var ascii = -1;
		if (e.keyCode)
			ascii = e.keyCode;
		else if (e.which)
			ascii = e.which;
		return ascii;
	};

	var get_background_position = function(){
		var bg_x, bg_y;
		if(_background_position.x == null) {
			bg_x = (parseInt(($(window).width() - _background.width))/2) + "px";
		} else {
			bg_x = _background_position.x + "px";
		}
		if(_background_position.y == null) {
			bg_y = "0px";
		} else {
			bg_y = _background_position.y + "px";
		}
		return {x: bg_x, y: bg_y};
	};
	
	/**
	 * Set the background image
	 * @param i Image index
	 * @param change Should we enable background toggling
	 * @param go_for_parent_height Should we choose wrapper parent height or background image height
	 * @param snap_to_window Should we force background image to adjust itself to document coordinates
	 */
	var set_object_image = function(i, change, go_for_parent_height, snap_to_window) {

		if (i == undefined) {
			for (var index in _settings.images) {
				var this_combination = combination_to_string(convert_keys_to_string());
				if (_settings.images[index].key == this_combination) {
					i = index;
				}
			}
		}

		if (change == undefined)
			change = true;

		if (_is_in_scope) {
			go_for_parent_height = true;
			snap_to_window = true;
		}

		if (go_for_parent_height == undefined)
			go_for_parent_height = false;

		if (snap_to_window == undefined)
			snap_to_window = false;

		if (i !== false && i != undefined) {
			if (_current_image == i && change) {
				_current_image = -1;
				_wrapper.css({
					background: "transparent"
				});
			} else {
				_current_image = i;
				var bg_x, bg_y;
				
				if(_drag_keep_position) {
					var bg = get_background_position();
					bg_x = bg.x;
					bg_y = bg.y;
				} else {
					if (snap_to_window) {
						var p = _wrapper.offset();
						bg_x = "center";
						bg_y = -p.top + "px";
						_background_position.y = -p.top;
					} else {
						bg_x = 'center';
						bg_y = 'top';
					}
				}
				
				_wrapper.css({
					background: "transparent url('" + _settings.images[i].src + "') " + bg_x + " " + bg_y + " no-repeat"
				});
				if (_settings.autofit) {
					// Check if we should take wrapper parent height into account. Otherwise we'll just set it to our backgorund image height
					if (go_for_parent_height) {
						_wrapper.height(_wrapper.parent().height());
					} else {
						// Initialize DOM Image object
						var img_obj = new Image();
						// Set the image
						img_obj.src = _settings.images[i].src;
						// Wait for the image to load
						img_obj.onload = function() {
							_background = img_obj;
							if (img_obj.height > 0) {
								// Tadaaaaa, fake height is set
								_wrapper.height(img_obj.height);
							}
						};
					}
				}
			}
			set_state('image');
		}
	};

	/**
	 * Method responsable for analising the keys that are pressed
	 */
	var check_combination_and_execute = function() {
		$(window).bind('keydown.check_combination_and_execute', function(e) {
			if (!in_array(get_key(e), _is_being_pressed)) {
				_is_being_pressed.push(e.keyCode);
				for (var i in _callback_queue) {
					_callback_queue[i]();
				}
			}
		});
		$(window).bind('keyup.check_combination_and_execute', function(e) {
			set_helper_message(null);
			$('.projetizr-scope-border').each(function(){
				$(this).removeClass('projetizr-scope-border');
			});
			if (in_array(get_key(e), _is_being_pressed)) {
				var index = -1;
				if (e.keyCode)
					index = _is_being_pressed.indexOf(e.keyCode);
				else if (e.which)
					index = _is_being_pressed.indexOf(e.which);
				if (index != -1) _is_being_pressed.splice(index, 1);
			}
		});
	};

	/**
	 *	Our main drag method
	 */
	var check_for_drag = function() {

		var is_mouse_left_button_down = false;
		var is_mouse_right_button_down = false;

		// Disable right click context menu while we have our drag activator... well... active :)
		window.oncontextmenu = function() { if(is_mouse_right_button_down) return false;};

		$(window).bind('mousedown.check_for_drag', function(e) {

			var this_combination = combination_to_string(convert_keys_to_string());
			if(this_combination == _settings.dragActivator) {
				if(e.button == 2) {
					is_mouse_right_button_down = this_combination == _settings.dragActivator;
				} else {
					is_mouse_left_button_down = this_combination == _settings.dragActivator;
				}

				// Add opacity to rulers
				$('.projetizr-ruler').fadeTo(250,0.5);
			}
		});

		$(window).bind('mouseup.check_for_drag', function(e) {
			if(e.button == 2) {
				is_mouse_right_button_down = false;
			} else {
				is_mouse_left_button_down = false;
			}

			// Remove opacity form rulers
			$('.projetizr-ruler').fadeTo(250,1);

			// Set state (drag)
			set_state('drag');

			_last_mouse_position = {x: null, y: null};
		});

		$(window).bind('mousemove.check_for_drag', function(e) {
			var bg, bg_x, bg_y;

			if (is_mouse_left_button_down || is_mouse_right_button_down) {
				if (_last_mouse_position.x == null && _last_mouse_position.y == null) {
					_last_mouse_position = {x: e.clientX, y: e.clientY};
				}

				bg = get_background_position();
				_background_position.x = parseInt(bg.x.replace('px',''));
				_background_position.y = parseInt(bg.y.replace('px',''));

				if(is_mouse_left_button_down || !_settings.dragMouseControl) {
					if (e.clientX > _background_position.x)
						_background_position.x += e.clientX - _last_mouse_position.x;
					else if (e.clientX < _background_position.x)
						_background_position.x -= _last_mouse_position.x - e.clientX;
				}
				if(is_mouse_right_button_down || !_settings.dragMouseControl) {
					if (e.clientY > _background_position.y)
						_background_position.y += e.clientY - _last_mouse_position.y;
					else if (e.clientY < _background_position.y)
						_background_position.y -= _last_mouse_position.y - e.clientY;
				}

				_last_mouse_position.x = e.clientX;
				_last_mouse_position.y = e.clientY;

				// Apply new backgrond position
				set_wrapper_background_position();

				// If we're in scope state we should add one more step on the reset functionality
				if(_is_in_scope)
					_reset_scope = true;

				_drag_keep_position = true;

				// Cancel out any text selections
				document.body.focus();
				// Prevent text selection in IE
				document.onselectstart = function () {
					return false;
				};
				// Prevent text selection (except IE)
				return false;
			}
		});
	};

	/**
	 *	Our main scope method
	 */
	var check_for_scope = function() {
		var scope_is_set = false;
		var this_combination = combination_to_string(convert_keys_to_string());
		if (this_combination == _settings.scopeSelectActivator) {
			$('*').bind('mouseenter.check_for_scope', function() {
				if (!scope_is_set) {
					// Set scope border
					$(this).addClass('projetizr-scope-border');
					$(this).bind('click.check_for_scope_child_1', function() {
						// Inform the plugin that we are on scopped state
						_is_in_scope = true;
						// Set current scope
						set_current_scope($(this));
						// Cancel out any text selections
						document.body.focus();
						// Prevent text selection in IE
						document.onselectstart = function () {
							return false;
						};
						// Prevent text selection (except IE)
						return false;
					});
					// This flag will ensure that only the far most child is chosen
					scope_is_set = true;
				}
			});
			$('*').bind('mouseout.check_for_scope', function() {
				// Remove scope border
				$(this).removeClass('projetizr-scope-border');
				$(this).unbind('click.check_for_scope_child_1');
				// Backout from scope state
				scope_is_set = false;
				_is_in_scope = false;
			});
		}
		$(window).bind('keyup.check_for_scope', function() {
			$('*').unbind('mouseenter.check_for_scope');
			$('*').unbind('mouseout.check_for_scope');
			scope_is_set = false;
		});
	};

	/**
	 *
	 */
	var check_for_ruler = function(forceRuler,forceGuides) {
		// Default values
		if(!forceRuler)
			forceRuler = false;
		if(!forceGuides)
			forceGuides = false;

		var speed = 150;
		var this_combination = combination_to_string(convert_keys_to_string());
		if (this_combination == _settings.rulerActivator || forceRuler) {
			if($('#projetizr-ruler-x').css('top') === '-16px') {
				_ruler_is_open = true;
				// Set state (ruler)
				set_state('ruler');
				$('#projetizr-ruler-x').animate({
					top: '0'
				},speed);
				$('#projetizr-ruler-y').animate({
					left: '0'
				},speed);
				$(window).bind('mousemove.ruler', function(e){
					$('#projetizr-ruler-position-x').css({
						left: (e.clientX-15 > 0 ? e.clientX : 15 )+'px'
					}).html((e.clientX-15 > 0 ? e.clientX-15 : 0 )+'px');
					$('#projetizr-ruler-position-y').css({
						top: (e.clientY-15 > 0 ? e.clientY : 15 )+'px'
					}).html((e.clientY-15 > 0 ? e.clientY-15 : 0 )+'px');
					$('.projetizr-ruler-position').show();
				});
			} else {
				_ruler_is_open = false;
				// Set state (ruler)
				set_state('ruler');
				$('#projetizr-ruler-x').animate({
					top: '-16px'
				},speed);
				$('#projetizr-ruler-y').animate({
					left: '-16px'
				},speed);
				$(window).unbind('mousemove.ruler');
				$('.projetizr-ruler-position').hide();
			}
		}
		if (this_combination == _settings.rulerGuidesActivator || forceGuides) {
			if(_ruler_is_open) {
				if(_ruler_guides_are_open) {
					$('.projetizr-ruler-guides').hide();
					$(window).unbind('mousemove.ruler-guides');
					_ruler_guides_are_open = false;
					// Set state (ruler)
					set_state('ruler-guides');
				} else {
					$(window).bind('mousemove.ruler-guides', function(e){
						$('#projetizr-ruler-guides-x').css({
							left: (e.clientX)+'px'
						});
						$('#projetizr-ruler-guides-y').css({
							top: (e.clientY)+'px'
						});
					});
					$('.projetizr-ruler-guides').show();
					_ruler_guides_are_open = true;
					// Set state (ruler)
					set_state('ruler-guides');
				}
			}
		}
	};

	/**
	 *	This will keep our document aware for when the user presses the esc button
	 */
	var check_for_reset = function() {
		var this_combination = combination_to_string(convert_keys_to_string());
		if (this_combination == 'esc') {
			reset();
		}
	};

	/**
	 * 
	 * @param selected_scope
	 */
	var get_current_scope = function(selected_scope) {
		// We might have the case where an element has more than one class.
		// In that case we need to first filter out the one we want... if it exists of course.
		var classes = selected_scope.attr('class').split(' ');
		for(var i in classes) {
			// We're matching it with the scope class namespace
			if(classes[i].toString().substr(0,6) == 'scope-') {
				return classes[i];
			}
		}
	};

	/**
	 * 
	 * @param selected_scope
	 */
	var set_current_scope = function(selected_scope) {
		// Only set scope if we have a valid element
		if(selected_scope.length > 0) {
			var scope = '';
			// Check if we want to reset the scope
			if(selected_scope !== null)
				scope = get_current_scope(selected_scope);
			// If we have a scope, got for it!
			if(scope !== '') {
				_current_scope = scope;
				// Set state (scope)
				set_state('scope');
			} else
				_current_scope = null;
			// Set our wrapper to this new element
			set_wrapper_to_('.'+get_current_scope(selected_scope));
			set_object_image(_current_image, false, true, true);
			// Force remove the border around this element as we won't be needing it anymore
			$('.projetizr-scope-border').each(function(){
				$(this).removeClass('projetizr-scope-border');
			});
		}
	};

	/**
	 *	Method responsable for resetting everything to its initial state
	 */
	var reset = function() {
		if(_reset_scope) {
			var p = _wrapper.offset();
			_background_position = {x: null, y: -p.top};
			_last_mouse_position = {x: null, y: null};
			set_wrapper_background_position();
			_reset_scope = false;
		} else {
			_is_in_scope = false;
			_background_position = {x: null, y: null};
			_last_mouse_position = {x: null, y: null};
			set_wrapper_to_('body');
			set_object_image(_current_image, false);
		}
		set_state('drag');
		$('.projetizr-scope-border').each(function(){
			$(this).removeClass('projetizr-scope-border');
		});
		_drag_keep_position = false;
	};

	/**
	 *
	 * @param message
	 */
	var set_helper_message = function(message) {
		if(_settings.helper) {
			if(message == null)
				$('#projetizr-helper').hide();
			else {
				$('#projetizr-helper').html(message).show();
			}
		}
	};

	var set_wrapper_background_position = function() {
		var bg = get_background_position();

		var bg_x = bg.x;
		var bg_y = bg.y;

		// Set our new background position
		_wrapper.css({ backgroundPosition: bg_x + " " + bg_y });
	};

	var get_state = function(split_childs) {

		if(split_childs == undefined)
			split_childs = true;

		var object = {};
		var hash = window.location.hash;
		var hash_array = hash.toString().slice(1).split(';');
		if(hash_array.length > 0 && hash_array != '') {
			for(var i in hash_array) {
				var t = hash_array[i].toString().split(':');
				if(split_childs)
					object[t[0]] = t[1].split('|');
				else
					object[t[0]] = t[1];
			}
		}
		return object;
	};

	var set_state = function(type) {

		if(type === null) {
			window.location.hash = '';
		}

		var state = get_state(false);
		
		switch(type) {
			case 'image':
				state['i'] = _current_image;
				break;
			case 'drag':
				var bg = get_background_position();
				state['d'] = bg.x.toString().replace('px','')+'|'+bg.y.toString().replace('px','');
				break;
			case 'scope':
				state['s'] = _current_scope;
				break;
			case 'ruler':
				if(_ruler_is_open)
					state['r'] = 1;
				else
					state['r'] = 0;
				break;
			case 'ruler-guides':
				if(_ruler_guides_are_open)
					state['rg'] = 1;
				else
					state['rg'] = 0;
				break;
		}
		
		var hash_array = [];
		hash_array.push('i:'+(state['i'] == 'undefined' ? '' : state['i'] ));
		hash_array.push('d:'+(state['d'] == 'undefined' ? '' : state['d'] ));
		hash_array.push('s:'+(state['s'] == 'undefined' ? '' : state['s'] ));
		hash_array.push('r:'+(state['r'] == 'undefined' ? 0 : state['r'] ));
		hash_array.push('rg:'+(state['rg'] == 'undefined' ? 0 : state['rg'] ));

		if(_settings.keepState)
			window.location.hash = hash_array.join(';');
	};

	var apply_state = function() {
		var state = get_state();
		var image_was_set = false;

		if(state.i != '') {
			_current_image = state.i;
		}
		if(state.s && state.s != '') {
			set_current_scope($('.'+state.s));
			if(state.i != '') {
				image_was_set = true;
			}
		}
		if(state.i != '' && !image_was_set) {
			set_object_image(state.i,false);
		}
		if(state.d) {
			if(state.d[0] == null)
				state.d[0] = 0;
			if(state.d[1] == null)
				state.d[1] = 0;
			// Fill global variables with new position
			_background_position.x = state.d[0];
			_background_position.y = state.d[1];
			// Call the setter for background position
			set_wrapper_background_position();
		}
		if(state.r && state.r == 1) {
			check_for_ruler(true,false);
		}
		if(state.rg && state.rg == 1) {
			check_for_ruler(false,true);
		}
	};

	$.fn.projetizr = function(user_settings) {
		_settings = jQuery.extend({
			// Configuration
			images:					[],			// (array) The list of images and key storkes assigned to those images. Example: [ { src: 'images/img1.jpg', key: 'ctrl+a' }, { src: 'images/img2.jpg', key: 'ctrl+b' } ]
			interactive:			true,		// (bool) Enable or disable key awareness
			autofit:				true,		// (bool) Auto fit height according to the background image
			drag:					true,		// (bool) Enable or disable drag awareness where you'll be able to freely move background image
			dragActivator:			'alt',		// (string) The key that will place your document on drag state
			dragMouseControl:		true,		// (bool) Enable or disable mouse control where left click will only move your background image x wise, right click y wise and both will enable free movement
			scopeSelect:			true,		// (bool) Enable or disable scope awareness where you'll be able to choose a specific chunk of your HTML document to apply the background image
			scopeSelectActivator:	'shift',	// (string) The key that will place your document on scope state
			helper:					true,		// (bool) Shoul I show a small bubble everytime you change state
			ruler:					true,
			rulerActivator:			'r',
			rulerGuidesActivator:	'ctrl+g',
			keepState:				true
		}, user_settings);

		return this.each(function() {
            // Make sure we only have one instance of projetizr wrapper active at once
            if($(".projetizr-wrapper").length == 0) {
                if (_settings.interactive && _settings.images.length > 0) {
                    add_action(set_object_image);
                }
                if (_settings.images.length > 0) {
                    set_wrapper_to_('body');
                    set_object_image(0, false);
                }
                if (_settings.drag) {
                    add_action(check_for_drag);
                }
                if (_settings.scopeSelect) {
					// Assign classes to all elements so that we can identify scopes
					var scope_i = 0;
					$('*').each(function(){
						$(this).addClass('scope-'+scope_i);
						scope_i++;
					});
                    add_action(check_for_scope);
                }
                if(_settings.helper)
                    $('body').append('<div id="projetizr-helper" style="position: fixed; bottom: 10px; right: 10px; background-color: #999; -moz-border-radius: 8px; border-radius: 8px; -webkit-border-radius: 8px; color: #fff; text-shadow: 0 1px 0 #333; line-height: 40px; padding: 0 15px; opacity: .6; font-size: 25px; -webkit-box-shadow: 0 0 7px black; -moz-box-shadow: 0 0 7px black; box-shadow: 0 0 7px black; display: none;"></div>');
                if(_settings.ruler) {
                    $('body').append('<div class="projetizr-ruler" id="projetizr-ruler-x" style="background: transparent url(\'images/ruler_x.png\') repeat-x top left; width: 100%; height: 16px; position: fixed; top: -16px; left: 0; z-index: 1001;"></div>');
                    $('body').append('<div class="projetizr-ruler" id="projetizr-ruler-y" style="background: transparent url(\'images/ruler_y.png\') repeat-y top left; width: 16px; height: 100%; position: fixed; top: 0; left: -16px; z-index: 1000;"></div>');
                    $('body').append('<div class="projetizr-ruler-position" id="projetizr-ruler-position-x" style="display: none; position: fixed; top: 16px; left: 0; z-index: 1002;"></div>');
                    $('body').append('<div class="projetizr-ruler-position" id="projetizr-ruler-position-y" style="display: none; position: fixed; top: 0; left: 16px; z-index: 1002;"></div>');
                    $('body').append('<div class="projetizr-ruler-guides" id="projetizr-ruler-guides-x" style="display: none; position: fixed; top: 0; left: 0; z-index: 999; width: 1px; height: 100%; background-color: #02fbff;"></div>');
                    $('body').append('<div class="projetizr-ruler-guides" id="projetizr-ruler-guides-y" style="display: none; position: fixed; top: 0; left: 0; z-index: 999; width: 100%; height: 1px;background-color: #02fbff;"></div>');
                    $('.projetizr-ruler-position').css({
                        backgroundColor: 	'#555',
                        padding:			'3px',
                        color:				'#fff',
                        zIndex:				'1002'
                    });
                    add_action(check_for_ruler);
                }
				if(_settings.keepState) {
					apply_state();
				}
                add_action(check_for_reset);
                check_combination_and_execute();
            }
		});
	}
})(jQuery);